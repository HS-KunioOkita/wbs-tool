import { describe, expect, it } from 'vitest';
import { Task } from '../../src/domain/task.js';
import { TaskPeriod } from '../../src/domain/task-period.js';
import { TaskProgress } from '../../src/domain/task-progress.js';
import { InputInvalidError } from '../../src/errors/app-errors.js';

const baseInput = () => ({
  taskId: 1,
  name: 'task A',
  assignee: '山田',
  period: TaskPeriod.of('2026-01-01', '2026-01-31'),
  progress: TaskProgress.of(0),
  parentTaskId: null as number | null,
  description: '',
});

describe('CLS-001 Task', () => {
  describe('VR-001 name required', () => {
    it('creates with valid name', () => {
      const t = new Task(baseInput());
      expect(t.name).toBe('task A');
    });

    it('trims surrounding whitespace', () => {
      const t = new Task({ ...baseInput(), name: '  task A  ' });
      expect(t.name).toBe('task A');
    });

    it('rejects empty name', () => {
      expect(() => new Task({ ...baseInput(), name: '' })).toThrow(InputInvalidError);
    });

    it('rejects whitespace-only name', () => {
      expect(() => new Task({ ...baseInput(), name: '   ' })).toThrow(InputInvalidError);
    });
  });

  describe('rename', () => {
    it('updates name', () => {
      const t = new Task(baseInput());
      t.rename('task B');
      expect(t.name).toBe('task B');
    });

    it('rejects empty rename', () => {
      const t = new Task(baseInput());
      expect(() => t.rename('')).toThrow(InputInvalidError);
    });
  });

  describe('setParent VR-004 self-loop', () => {
    it('rejects setting parent to self', () => {
      const t = new Task(baseInput());
      expect(() => t.setParent(1)).toThrow(InputInvalidError);
    });

    it('allows null parent (top-level)', () => {
      const t = new Task({ ...baseInput(), parentTaskId: 2 });
      t.setParent(null);
      expect(t.parentTaskId).toBe(null);
    });
  });

  it('reschedule replaces period', () => {
    const t = new Task(baseInput());
    const newPeriod = TaskPeriod.of('2026-02-01', '2026-02-28');
    t.reschedule(newPeriod);
    expect(t.period.startDate).toBe('2026-02-01');
  });

  it('updateProgress replaces progress', () => {
    const t = new Task(baseInput());
    t.updateProgress(TaskProgress.of(75));
    expect(t.progress.value).toBe(75);
  });
});
