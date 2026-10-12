import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CommandBar, type CommandBarProps } from './CommandBar';

function props(over: Partial<CommandBarProps> = {}): CommandBarProps {
  return {
    onSaveSvg: vi.fn(),
    onOpenSvg: vi.fn(),
    onNew: vi.fn(),
    ...over,
  };
}

function openMenu(name: RegExp) {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

afterEach(() => vi.restoreAllMocks());

describe('CommandBar', () => {
  it('starts a new document at the paper size picked from New', () => {
    const p = props();
    render(<CommandBar {...p} />);
    openMenu(/New/);
    fireEvent.click(screen.getByRole('menuitem', { name: 'A4' }));
    expect(p.onNew).toHaveBeenCalledWith('a4');
  });

  it('opens a debug surface in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<CommandBar {...props()} />);
    openMenu(/Debug/);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bundle Inspector' }));
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/#\/dev\/registry$/), '_blank', 'noopener');
  });
});
