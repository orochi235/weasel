import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeBreadcrumb } from './ModeBreadcrumb';

describe('ModeBreadcrumb', () => {
  it('renders nothing in normal mode', () => {
    const { container } = render(
      <ModeBreadcrumb modeId="normal" modeKind="soft" targetLabel={null} onExit={vi.fn()} onCommit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the soft variant with name, label, and Exit button', () => {
    const onExit = vi.fn();
    render(
      <ModeBreadcrumb modeId="path-edit" modeKind="soft" targetLabel="Circle Path" onExit={onExit} onCommit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText(/path edit/i)).toBeTruthy();
    expect(screen.getByText('Circle Path')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /exit/i }));
    expect(onExit).toHaveBeenCalled();
  });

  it('renders the strict variant with Cancel and Commit buttons', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <ModeBreadcrumb modeId="free-transform" modeKind="strict" targetLabel={null} onExit={vi.fn()} onCommit={onCommit} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /commit/i }));
    expect(onCommit).toHaveBeenCalled();
  });

  it('omits target label when null', () => {
    render(
      <ModeBreadcrumb modeId="free-transform" modeKind="strict" targetLabel={null} onExit={vi.fn()} onCommit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.queryByText(/·/)).toBeNull();  // separator absent without label
  });
});
