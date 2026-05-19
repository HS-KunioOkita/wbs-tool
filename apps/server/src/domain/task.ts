import { VR } from '@wbs-tool/shared';
import { InputInvalidError } from '../errors/app-errors.js';
import type { TaskPeriod } from './task-period.js';
import type { TaskProgress } from './task-progress.js';

export interface TaskInput {
  taskId: number;
  name: string;
  assignee: string;
  period: TaskPeriod;
  progress: TaskProgress;
  parentTaskId: number | null;
  description: string;
}

/**
 * CLS-001 タスク（エンティティ）。
 * 自身に閉じた不変条件（VR-001 名前必須）のみを守る。
 * 親子循環・派生値再算出は集約ルート（CLS-004）が担う。
 */
export class Task {
  private _name: string;
  private _assignee: string;
  private _period: TaskPeriod;
  private _progress: TaskProgress;
  private _parentTaskId: number | null;
  private _description: string;

  constructor(input: TaskInput) {
    Task.validateName(input.name);
    this._name = input.name.trim();
    this._assignee = input.assignee;
    this._period = input.period;
    this._progress = input.progress;
    this._parentTaskId = input.parentTaskId;
    this._description = input.description;
    this.taskId = input.taskId;
  }

  readonly taskId: number;

  get name(): string {
    return this._name;
  }

  get assignee(): string {
    return this._assignee;
  }

  get period(): TaskPeriod {
    return this._period;
  }

  get progress(): TaskProgress {
    return this._progress;
  }

  get parentTaskId(): number | null {
    return this._parentTaskId;
  }

  get description(): string {
    return this._description;
  }

  rename(name: string): void {
    Task.validateName(name);
    this._name = name.trim();
  }

  reschedule(period: TaskPeriod): void {
    this._period = period;
  }

  updateProgress(progress: TaskProgress): void {
    this._progress = progress;
  }

  updateAssignee(assignee: string): void {
    this._assignee = assignee;
  }

  updateDescription(description: string): void {
    this._description = description;
  }

  setParent(parentTaskId: number | null): void {
    if (parentTaskId !== null && parentTaskId === this.taskId) {
      // 自己ループ単体の検出（VR-004 の最小ケース）
      throw new InputInvalidError('parent_task_id must not be self', {
        details: [VR.TASK_PARENT_NO_CYCLE],
        field: 'parent_task_id',
      });
    }
    this._parentTaskId = parentTaskId;
  }

  private static validateName(name: string): void {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new InputInvalidError('task name must not be empty', {
        details: [VR.TASK_NAME_REQUIRED],
        field: 'name',
      });
    }
  }
}
