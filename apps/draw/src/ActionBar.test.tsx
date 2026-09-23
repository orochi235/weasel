import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ActionBar, type ActionBarProps } from './ActionBar';

function props(over: Partial<ActionBarProps> = {}): ActionBarProps {
  return {
    onSaveSvg: vi.fn(),
    onOpenSvg: vi.fn(),
    onNew: vi.fn(),
    gridVisible: false,
    onToggleGrid: vi.fn(),
    snapToGrid: false,
    onToggleSnap: vi.fn(),
    canReleaseCompound: false,
    onReleaseCompound: vi.fn(),
    onOpenPrefs: vi.fn(),
    recording: false,
    onToggleRecord: vi.fn(),
    recordingProfile: 'gesture-only',
    onChangeRecordingProfile: vi.fn(),
    onPlay: vi.fn(),
    ...over,
  };
}

function openMenu(name: RegExp) {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

afterEach(() => vi.restoreAllMocks());

describe('ActionBar', () => {
  it('starts a new document at the paper size picked from New', () => {
    const p = props();
    render(<ActionBar {...p} />);
    openMenu(/New/);
    fireEvent.click(screen.getByRole('menuitem', { name: 'A4' }));
    expect(p.onNew).toHaveBeenCalledWith('a4');
  });

  it('opens a debug surface in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<ActionBar {...props()} />);
    openMenu(/Debug/);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bundle Inspector' }));
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/#\/dev\/registry$/), '_blank', 'noopener');
  });

  it('shows grid and snap as pressed toggles and flips only the one clicked', () => {
    const p = props({ gridVisible: true });
    render(<ActionBar {...p} />);
    expect(screen.getByRole('button', { name: 'Show grid' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Snap to grid' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Snap to grid' }));
    expect(p.onToggleSnap).toHaveBeenCalledTimes(1);
    expect(p.onToggleGrid).not.toHaveBeenCalled();
  });

  it('marks the record button pressed while recording and locks the profile', () => {
    render(<ActionBar {...props({ recording: true })} />);
    expect(screen.getByRole('button', { name: 'Record input' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Recording profile/ }).hasAttribute('disabled')).toBe(true);
  });

  it('changes the recording profile', () => {
    const p = props();
    render(<ActionBar {...p} />);
    openMenu(/Recording profile/);
    fireEvent.click(screen.getByRole('option', { name: 'Full fidelity' }));
    expect(p.onChangeRecordingProfile).toHaveBeenCalledWith('full');
  });
});
