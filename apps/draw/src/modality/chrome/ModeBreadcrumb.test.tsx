import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { FREE_TRANSFORM, NORMAL, PATH_EDIT } from '@weasel-js/modes';
import { ModeBreadcrumb } from './ModeBreadcrumb';
import { renderWithIcons } from '../../testIcons';

describe('ModeBreadcrumb', () => {
  it('renders nothing in normal mode', () => {
    const { container } = renderWithIcons(
      <ModeBreadcrumb mode={NORMAL} targetLabel={null} onExit={vi.fn()} onCommit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the soft variant with name, label, and Exit button', () => {
    const onExit = vi.fn();
    renderWithIcons(
      <ModeBreadcrumb mode={PATH_EDIT} targetLabel="Circle Path" onExit={onExit} onCommit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText(/path edit/i)).toBeTruthy();
    expect(screen.getByText('Circle Path')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /exit/i }));
    expect(onExit).toHaveBeenCalled();
  });

  it('renders the strict variant with Cancel and Commit buttons', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    renderWithIcons(
      <ModeBreadcrumb mode={FREE_TRANSFORM} targetLabel={null} onExit={vi.fn()} onCommit={onCommit} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /commit/i }));
    expect(onCommit).toHaveBeenCalled();
  });

  it('omits target label when null', () => {
    renderWithIcons(
      <ModeBreadcrumb mode={FREE_TRANSFORM} targetLabel={null} onExit={vi.fn()} onCommit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.queryByText(/·/)).toBeNull();  // separator absent without label
  });

  it('names the entered group in normal mode, and its Exit leaves the group', () => {
    const onGroupExit = vi.fn();
    const onExit = vi.fn();
    renderWithIcons(
      <ModeBreadcrumb mode={NORMAL} targetLabel={null} group={{ label: 'Logo', onExit: onGroupExit }}
        onExit={onExit} onCommit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText('Group')).toBeTruthy();
    expect(screen.getByText('Logo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /exit/i }));
    expect(onGroupExit).toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('names the group and the mode open inside it, with the mode\'s own buttons', () => {
    const onGroupExit = vi.fn();
    const onExit = vi.fn();
    renderWithIcons(
      <ModeBreadcrumb mode={PATH_EDIT} targetLabel="Star" group={{ label: 'Logo', onExit: onGroupExit }}
        onExit={onExit} onCommit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText('Logo')).toBeTruthy();
    expect(screen.getByText(/path edit/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /exit/i }));
    expect(onExit).toHaveBeenCalled();
    expect(onGroupExit).not.toHaveBeenCalled();
  });
});
