import { isDifferentTaskPair, VR } from '@wbs-tool/shared';
import { InputInvalidError } from '../errors/app-errors.js';

/**
 * CLS-005 依存関係（エンティティ）。
 * 識別子は dependency_id だが、属性変更操作は持たない（変更は削除 + 追加で表現）。
 * VR-005（自己依存禁止）のみ自己責任、他は集約ルートに委譲する。
 */
export class Dependency {
  private constructor(
    public readonly dependencyId: number,
    public readonly predecessorTaskId: number,
    public readonly successorTaskId: number,
  ) {}

  static of(input: {
    dependencyId: number;
    predecessorTaskId: number;
    successorTaskId: number;
  }): Dependency {
    if (!isDifferentTaskPair(input.predecessorTaskId, input.successorTaskId)) {
      throw new InputInvalidError('predecessor must differ from successor', {
        details: [VR.DEP_NOT_SELF],
        field: 'predecessor_task_id',
      });
    }
    return new Dependency(input.dependencyId, input.predecessorTaskId, input.successorTaskId);
  }

  /** 同じペアか（VR-006 検査の補助）。 */
  sharesPair(other: Dependency): boolean {
    return (
      this.predecessorTaskId === other.predecessorTaskId &&
      this.successorTaskId === other.successorTaskId
    );
  }
}
