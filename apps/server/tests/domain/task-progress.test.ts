import { describe, expect, it } from 'vitest';
import { TaskProgress } from '../../src/domain/task-progress.js';
import { InputInvalidError } from '../../src/errors/app-errors.js';

describe('CLS-003 TaskProgress', () => {
  describe('VR-003 range [0, 100] integer', () => {
    it('accepts 0', () => expect(TaskProgress.of(0).value).toBe(0));
    it('accepts 100', () => expect(TaskProgress.of(100).value).toBe(100));
    it('accepts middle', () => expect(TaskProgress.of(42).value).toBe(42));

    it('rejects -1', () => expect(() => TaskProgress.of(-1)).toThrow(InputInvalidError));
    it('rejects 101', () => expect(() => TaskProgress.of(101)).toThrow(InputInvalidError));
    it('rejects non-integer', () => expect(() => TaskProgress.of(42.5)).toThrow(InputInvalidError));
    it('rejects NaN', () => expect(() => TaskProgress.of(Number.NaN)).toThrow(InputInvalidError));
  });

  it('isCompleted is true only at 100', () => {
    expect(TaskProgress.of(100).isCompleted()).toBe(true);
    expect(TaskProgress.of(99).isCompleted()).toBe(false);
    expect(TaskProgress.of(0).isCompleted()).toBe(false);
  });

  it('equals compares value', () => {
    expect(TaskProgress.of(50).equals(TaskProgress.of(50))).toBe(true);
    expect(TaskProgress.of(50).equals(TaskProgress.of(51))).toBe(false);
  });
});
