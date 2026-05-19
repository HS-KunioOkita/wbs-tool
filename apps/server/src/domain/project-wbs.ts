import { VR } from '@wbs-tool/shared';
import {
  BusinessRuleViolationError,
  InputInvalidError,
  NotFoundError,
} from '../errors/app-errors.js';
import { Dependency } from './dependency.js';
import { Task } from './task.js';
import type { TaskPeriod } from './task-period.js';
import { TaskProgress } from './task-progress.js';

export interface ProjectWbsSnapshot {
  projectId: number;
  projectName: string;
  description: string;
  createdAt: string;
  tasks: Task[];
  dependencies: Dependency[];
}

export interface AddTaskInput {
  taskId: number;
  name: string;
  assignee: string;
  period: TaskPeriod;
  progress: TaskProgress;
  parentTaskId: number | null;
  description: string;
}

export interface UpdateTaskInput {
  name?: string;
  assignee?: string;
  period?: TaskPeriod;
  progress?: TaskProgress;
  parentTaskId?: number | null;
  description?: string;
}

export interface DeleteTaskResult {
  promotedChildTaskIds: number[];
  deletedDependencyIds: number[];
  recalculatedAncestors: Task[];
}

export interface AddDependencyInput {
  dependencyId: number;
  predecessorTaskId: number;
  successorTaskId: number;
}

/**
 * CLS-004 プロジェクト WBS（集約ルート）。
 * 集約境界 AGG-001。VR-004/6/7/8/9/10 / RULE-009/10/11/13 の番人。
 *
 * 設計判断:
 * - 親派生値（start_date / due_date / progress）は書き込み時に再算出して永続化（RULE-009/10）
 * - 子をすべて失った親は直前値を保持し、利用者が UI で編集可能化（OPEN-02 確定: 直前値保持）
 * - 親 progress 集約は期間日数で重み付き平均、整数四捨五入（OPEN-01 確定: 期間重み付き平均）
 */
export class ProjectWbs {
  private readonly _tasks: Map<number, Task>;
  private readonly _dependencies: Map<number, Dependency>;
  private _name: string;
  private _description: string;

  constructor(snapshot: ProjectWbsSnapshot) {
    ProjectWbs.validateName(snapshot.projectName);
    this.projectId = snapshot.projectId;
    this._name = snapshot.projectName.trim();
    this._description = snapshot.description;
    this.createdAt = snapshot.createdAt;
    this._tasks = new Map(snapshot.tasks.map((t) => [t.taskId, t]));
    this._dependencies = new Map(snapshot.dependencies.map((d) => [d.dependencyId, d]));

    // 生成時の整合性: parent / dep 参照先が tasks 内に存在すること
    for (const t of this._tasks.values()) {
      if (t.parentTaskId !== null && !this._tasks.has(t.parentTaskId)) {
        throw new BusinessRuleViolationError('parent_task_id refers to non-existent task', {
          details: [VR.SAME_PROJECT],
          field: 'parent_task_id',
        });
      }
    }
    for (const d of this._dependencies.values()) {
      if (!this._tasks.has(d.predecessorTaskId) || !this._tasks.has(d.successorTaskId)) {
        throw new BusinessRuleViolationError('dependency refers to non-existent task', {
          details: [VR.SAME_PROJECT],
        });
      }
    }
  }

  readonly projectId: number;
  readonly createdAt: string;

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  tasks(): readonly Task[] {
    return Array.from(this._tasks.values());
  }

  dependencies(): readonly Dependency[] {
    return Array.from(this._dependencies.values());
  }

  rename(name: string): void {
    ProjectWbs.validateName(name);
    this._name = name.trim();
  }

  updateDescription(description: string): void {
    this._description = description;
  }

  /**
   * 新規タスクの仮 ID を採番する。`save()` 時に SQLite へその ID で永続化される。
   * 単一利用者・単一プロセス前提のため `max + 1` で十分。
   */
  nextTaskId(): number {
    let max = 0;
    for (const t of this._tasks.values()) {
      if (t.taskId > max) max = t.taskId;
    }
    return max + 1;
  }

  nextDependencyId(): number {
    let max = 0;
    for (const d of this._dependencies.values()) {
      if (d.dependencyId > max) max = d.dependencyId;
    }
    return max + 1;
  }

  // ============================================================
  // Task operations
  // ============================================================

  /**
   * UC-002 / RULE-009/10 タスクを追加し、親系統を再算出する。
   */
  addTask(input: AddTaskInput): { recalculatedAncestors: Task[] } {
    if (this._tasks.has(input.taskId)) {
      throw new InputInvalidError(`task_id ${input.taskId} already exists`);
    }

    if (input.parentTaskId !== null) {
      this.assertTaskExists(input.parentTaskId, 'parent_task_id');
    }

    const task = new Task(input);
    this._tasks.set(task.taskId, task);

    return {
      recalculatedAncestors: this.recalculateAncestorsOf(task.taskId),
    };
  }

  /**
   * UC-003 / UC-007 タスク属性更新。VR-004 / VR-010 / RULE-009/10/11 を守る。
   */
  updateTask(taskId: number, input: UpdateTaskInput): { recalculatedAncestors: Task[] } {
    const task = this.requireTask(taskId);

    const wantsRescheduleOrProgress = input.period !== undefined || input.progress !== undefined;
    const isParent = this.isParentTask(taskId);

    if (wantsRescheduleOrProgress && isParent) {
      throw new BusinessRuleViolationError(
        'parent task cannot directly change schedule or progress',
        { details: [VR.PARENT_FIELDS_READONLY] },
      );
    }

    let previousParent: number | null = null;
    let parentChanged = false;

    if (input.parentTaskId !== undefined) {
      const newParent = input.parentTaskId;
      if (newParent !== null) {
        this.assertTaskExists(newParent, 'parent_task_id');
        if (this.wouldCreateParentCycle(taskId, newParent)) {
          throw new BusinessRuleViolationError(
            'changing parent would create a cycle in parent-child graph',
            { details: [VR.TASK_PARENT_NO_CYCLE], field: 'parent_task_id' },
          );
        }
      }
      previousParent = task.parentTaskId;
      parentChanged = newParent !== task.parentTaskId;
    }

    if (input.name !== undefined) task.rename(input.name);
    if (input.assignee !== undefined) task.updateAssignee(input.assignee);
    if (input.description !== undefined) task.updateDescription(input.description);
    if (input.period !== undefined) task.reschedule(input.period);
    if (input.progress !== undefined) task.updateProgress(input.progress);
    if (input.parentTaskId !== undefined) task.setParent(input.parentTaskId);

    const recalculated = new Map<number, Task>();
    const collect = (list: Task[]) => {
      for (const t of list) recalculated.set(t.taskId, t);
    };

    collect(this.recalculateAncestorsOf(task.taskId));
    if (parentChanged && previousParent !== null) {
      collect(this.recalculateAncestorsFrom(previousParent));
    }

    return { recalculatedAncestors: Array.from(recalculated.values()) };
  }

  /**
   * UC-004 / RULE-013 タスク削除。
   * - 子の parent_task_id を NULL に昇格（子の派生値は直前値を維持: OPEN-02）
   * - 関与する依存関係を連鎖削除
   * - 元の親系統を再算出
   */
  deleteTask(taskId: number): DeleteTaskResult {
    const task = this.requireTask(taskId);

    // 子を NULL に昇格
    const promotedChildTaskIds: number[] = [];
    for (const t of this._tasks.values()) {
      if (t.parentTaskId === taskId) {
        t.setParent(null);
        promotedChildTaskIds.push(t.taskId);
      }
    }

    // 関与する依存関係を削除
    const deletedDependencyIds: number[] = [];
    for (const [id, d] of this._dependencies) {
      if (d.predecessorTaskId === taskId || d.successorTaskId === taskId) {
        this._dependencies.delete(id);
        deletedDependencyIds.push(id);
      }
    }

    const originalParent = task.parentTaskId;
    this._tasks.delete(taskId);

    const recalculatedAncestors =
      originalParent !== null && this._tasks.has(originalParent)
        ? this.recalculateAncestorsFrom(originalParent)
        : [];

    return {
      promotedChildTaskIds,
      deletedDependencyIds,
      recalculatedAncestors,
    };
  }

  // ============================================================
  // Dependency operations
  // ============================================================

  /**
   * UC-005 依存関係追加。VR-005/6/7/8 を守る。
   */
  addDependency(input: AddDependencyInput): Dependency {
    if (this._dependencies.has(input.dependencyId)) {
      throw new InputInvalidError(`dependency_id ${input.dependencyId} already exists`);
    }
    this.assertTaskExists(input.predecessorTaskId, 'predecessor_task_id');
    this.assertTaskExists(input.successorTaskId, 'successor_task_id');

    // VR-006 重複禁止
    for (const d of this._dependencies.values()) {
      if (
        d.predecessorTaskId === input.predecessorTaskId &&
        d.successorTaskId === input.successorTaskId
      ) {
        throw new BusinessRuleViolationError(
          `duplicate dependency: ${input.predecessorTaskId} -> ${input.successorTaskId}`,
          { details: [VR.DEP_NO_DUPLICATE] },
        );
      }
    }

    // VR-007 循環依存禁止
    if (this.wouldCreateDependencyCycle(input.predecessorTaskId, input.successorTaskId)) {
      throw new BusinessRuleViolationError('adding dependency would create a cycle', {
        details: [VR.DEP_NO_CYCLE],
      });
    }

    const dep = Dependency.of(input); // VR-005 自己依存禁止
    this._dependencies.set(dep.dependencyId, dep);
    return dep;
  }

  deleteDependency(dependencyId: number): void {
    if (!this._dependencies.has(dependencyId)) {
      throw new NotFoundError(`dependency ${dependencyId} not found`);
    }
    this._dependencies.delete(dependencyId);
  }

  // ============================================================
  // Predicates
  // ============================================================

  isParentTask(taskId: number): boolean {
    for (const t of this._tasks.values()) {
      if (t.parentTaskId === taskId) return true;
    }
    return false;
  }

  /**
   * RULE-004: candidate を candidateParent の子に設定したときに親子サイクルが生じるか。
   * 都度 DFS（推移閉包は持たない）。
   */
  wouldCreateParentCycle(candidateChildId: number, candidateParentId: number): boolean {
    if (candidateChildId === candidateParentId) return true;
    // candidateParent が candidateChild の子孫であれば、新規の親リンクで循環が生じる。
    const stack = [candidateParentId];
    const visited = new Set<number>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === candidateChildId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const node = this._tasks.get(current);
      if (node?.parentTaskId !== null && node?.parentTaskId !== undefined) {
        stack.push(node.parentTaskId);
      }
    }
    return false;
  }

  /**
   * RULE-007: predecessor -> successor を追加したときに依存サイクルが生じるか。
   * 都度 DFS。
   */
  wouldCreateDependencyCycle(predecessorTaskId: number, successorTaskId: number): boolean {
    if (predecessorTaskId === successorTaskId) return true;

    // successor から先行する向き（successor の予定後続）を辿って predecessor に到達するか
    const adjacency = new Map<number, number[]>();
    for (const d of this._dependencies.values()) {
      const list = adjacency.get(d.predecessorTaskId) ?? [];
      list.push(d.successorTaskId);
      adjacency.set(d.predecessorTaskId, list);
    }
    const stack = [successorTaskId];
    const visited = new Set<number>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === predecessorTaskId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency.get(current) ?? []) {
        stack.push(next);
      }
    }
    return false;
  }

  // ============================================================
  // Ancestor recalculation (RULE-009 / RULE-010)
  // ============================================================

  /**
   * 葉側タスク（変更の起点）から親系統を辿り、各祖先の派生値を再算出する。
   */
  private recalculateAncestorsOf(leafChangedTaskId: number): Task[] {
    const node = this._tasks.get(leafChangedTaskId);
    const parentId = node?.parentTaskId ?? null;
    if (parentId === null) return [];
    return this.recalculateAncestorsFrom(parentId);
  }

  /**
   * 指定タスクから祖先（自身含む）を順次再算出する。
   */
  private recalculateAncestorsFrom(startTaskId: number): Task[] {
    const recalculated: Task[] = [];
    let cursor: number | null = startTaskId;
    const visited = new Set<number>();
    while (cursor !== null) {
      if (visited.has(cursor)) break; // VR-004 で守られているが多重防御
      visited.add(cursor);
      const task = this._tasks.get(cursor);
      if (!task) break;
      const children = this.childrenOf(cursor);
      if (children.length > 0) {
        const newPeriod = this.aggregatePeriod(children);
        const newProgress = this.aggregateProgress(children);
        task.reschedule(newPeriod);
        task.updateProgress(newProgress);
        recalculated.push(task);
      }
      // OPEN-02: 子をすべて失った親は直前値を保持（更新せず）
      cursor = task.parentTaskId;
    }
    return recalculated;
  }

  private childrenOf(parentId: number): Task[] {
    return this.tasks().filter((t) => t.parentTaskId === parentId);
  }

  /** RULE-009: 期間 = 子の min(start) / max(due) */
  private aggregatePeriod(children: Task[]): TaskPeriod {
    let acc = children[0]!.period;
    for (let i = 1; i < children.length; i++) {
      acc = acc.combine(children[i]!.period);
    }
    return acc;
  }

  /**
   * RULE-010 (OPEN-01 確定: 期間重み付き平均):
   * progress = round( Σ(child.progress * child.durationDays) / Σ(child.durationDays) )
   */
  private aggregateProgress(children: Task[]): TaskProgress {
    let weightedSum = 0;
    let totalDays = 0;
    for (const c of children) {
      const w = c.period.durationDays();
      weightedSum += c.progress.value * w;
      totalDays += w;
    }
    // durationDays() は常に >= 1（VR-002 を満たすため）。totalDays > 0 は保証される。
    const raw = weightedSum / totalDays;
    const rounded = Math.round(raw);
    const clamped = Math.max(0, Math.min(100, rounded));
    return TaskProgress.of(clamped);
  }

  // ============================================================
  // Internal helpers
  // ============================================================

  private requireTask(taskId: number): Task {
    const t = this._tasks.get(taskId);
    if (!t) throw new NotFoundError(`task ${taskId} not found`);
    return t;
  }

  private assertTaskExists(taskId: number, field: string): void {
    if (!this._tasks.has(taskId)) {
      throw new BusinessRuleViolationError(`referenced task ${taskId} is not in this project`, {
        details: [VR.SAME_PROJECT],
        field,
      });
    }
  }

  private static validateName(name: string): void {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new InputInvalidError('project name must not be empty', {
        details: [VR.PROJECT_NAME_REQUIRED],
        field: 'name',
      });
    }
  }
}
