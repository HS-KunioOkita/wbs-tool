import { describe, expect, it } from 'vitest';
import { Dependency } from '../../src/domain/dependency.js';
import { InputInvalidError } from '../../src/errors/app-errors.js';

describe('CLS-005 Dependency', () => {
  it('builds with distinct predecessor and successor', () => {
    const d = Dependency.of({ dependencyId: 1, predecessorTaskId: 10, successorTaskId: 20 });
    expect(d.dependencyId).toBe(1);
    expect(d.predecessorTaskId).toBe(10);
    expect(d.successorTaskId).toBe(20);
  });

  it('VR-005 rejects self-dependency', () => {
    expect(() =>
      Dependency.of({ dependencyId: 1, predecessorTaskId: 10, successorTaskId: 10 }),
    ).toThrow(InputInvalidError);
  });

  it('sharesPair compares predecessor/successor pair', () => {
    const a = Dependency.of({ dependencyId: 1, predecessorTaskId: 10, successorTaskId: 20 });
    const b = Dependency.of({ dependencyId: 2, predecessorTaskId: 10, successorTaskId: 20 });
    const c = Dependency.of({ dependencyId: 3, predecessorTaskId: 20, successorTaskId: 10 });
    expect(a.sharesPair(b)).toBe(true);
    expect(a.sharesPair(c)).toBe(false);
  });
});
