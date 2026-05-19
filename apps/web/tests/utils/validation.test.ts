// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  validateDependencyPair,
  validateFilterRange,
  validateProgress,
  validateProjectName,
  validateTaskName,
  validateTaskPeriod,
} from '../../src/utils/validation.js';

describe('utils/validation (VR-NNN シェアード根拠)', () => {
  describe('validateProjectName (VR-009)', () => {
    it('OK for non-empty', () => expect(validateProjectName('プロジェクト A')).toBeNull());
    it('NG for empty', () => expect(validateProjectName('')?.code).toBe('VR-009'));
    it('NG for whitespace-only', () => expect(validateProjectName('   ')?.code).toBe('VR-009'));
  });

  describe('validateTaskName (VR-001)', () => {
    it('OK for non-empty', () => expect(validateTaskName('要件定義')).toBeNull());
    it('NG for empty', () => expect(validateTaskName('')?.code).toBe('VR-001'));
  });

  describe('validateTaskPeriod (VR-002)', () => {
    it('OK when start equals due', () =>
      expect(validateTaskPeriod('2026-01-01', '2026-01-01')).toBeNull());
    it('OK when start < due', () =>
      expect(validateTaskPeriod('2026-01-01', '2026-01-10')).toBeNull());
    it('NG when start > due', () =>
      expect(validateTaskPeriod('2026-01-20', '2026-01-10')?.code).toBe('VR-002'));
    it('NG when either is missing', () => {
      expect(validateTaskPeriod('', '2026-01-10')?.code).toBe('VR-002');
      expect(validateTaskPeriod('2026-01-01', '')?.code).toBe('VR-002');
    });
  });

  describe('validateProgress (VR-003)', () => {
    it('OK at 0 / 50 / 100', () => {
      expect(validateProgress(0)).toBeNull();
      expect(validateProgress(50)).toBeNull();
      expect(validateProgress(100)).toBeNull();
    });
    it('NG at -1 / 101 / 0.5', () => {
      expect(validateProgress(-1)?.code).toBe('VR-003');
      expect(validateProgress(101)?.code).toBe('VR-003');
      expect(validateProgress(0.5)?.code).toBe('VR-003');
    });
  });

  describe('validateDependencyPair (VR-005)', () => {
    it('OK when distinct', () => expect(validateDependencyPair(1, 2)).toBeNull());
    it('NG when same', () => expect(validateDependencyPair(1, 1)?.code).toBe('VR-005'));
  });

  describe('validateFilterRange (VR-011)', () => {
    it('OK when both null', () => expect(validateFilterRange(null, null)).toBeNull());
    it('OK when from <= to', () =>
      expect(validateFilterRange('2026-01-01', '2026-01-10')).toBeNull());
    it('NG when from > to', () =>
      expect(validateFilterRange('2026-02-01', '2026-01-10')?.code).toBe('VR-011'));
    it('OK when one side is null', () => {
      expect(validateFilterRange('2026-01-01', null)).toBeNull();
      expect(validateFilterRange(null, '2026-01-10')).toBeNull();
    });
  });
});
