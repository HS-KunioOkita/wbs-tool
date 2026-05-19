// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField, Input } from '../../src/components/FormField.js';

describe('FormField (T-070)', () => {
  it('shows required marker when required is true', () => {
    render(
      <FormField label="タスク名" required>
        <Input />
      </FormField>,
    );
    expect(screen.getByText('タスク名')).toBeInTheDocument();
    expect(screen.getByLabelText('必須')).toBeInTheDocument();
  });

  it('renders error message and applies invalid styling on the input', () => {
    render(
      <FormField label="期限" required error="開始日は期限以下にしてください">
        <Input invalid />
      </FormField>,
    );
    expect(screen.getByText('開始日は期限以下にしてください')).toBeInTheDocument();
  });

  it('shows hint when no error is set', () => {
    render(
      <FormField label="フィルタ" hint="例: 山田">
        <Input />
      </FormField>,
    );
    expect(screen.getByText('例: 山田')).toBeInTheDocument();
  });

  it('error takes precedence over hint', () => {
    render(
      <FormField label="フィルタ" hint="例: 山田" error="必須項目です">
        <Input />
      </FormField>,
    );
    expect(screen.getByText('必須項目です')).toBeInTheDocument();
    expect(screen.queryByText('例: 山田')).not.toBeInTheDocument();
  });
});
