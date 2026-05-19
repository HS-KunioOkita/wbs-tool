// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../../src/components/Button.js';

describe('Button (T-070)', () => {
  it('renders children and applies the requested variant class', () => {
    render(<Button variant="primary">保存</Button>);
    const btn = screen.getByRole('button', { name: '保存' });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/primary/);
  });

  it('disabled state blocks onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        押せない
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: '押せない' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards onClick when enabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>押せる</Button>);
    await user.click(screen.getByRole('button', { name: '押せる' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
