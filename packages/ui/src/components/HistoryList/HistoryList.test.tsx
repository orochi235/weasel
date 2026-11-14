import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HistoryList } from './HistoryList';

afterEach(() => { cleanup(); });

const ENTRIES = [
  { id: '__initial__', label: 'Initial' },
  { id: '1', label: 'Draw rect' },
  { id: '2', label: 'Fill' },
];

describe('HistoryList', () => {
  it('is a single-select listbox with the current state selected', () => {
    render(<HistoryList entries={ENTRIES} current={1} onJump={() => {}} />);
    expect(screen.getByRole('listbox', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Draw rect' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Fill' })).toHaveAttribute('aria-selected', 'false');
  });

  it('jumps to a clicked entry', () => {
    const onJump = vi.fn();
    render(<HistoryList entries={ENTRIES} current={2} onJump={onJump} />);
    fireEvent.click(screen.getByRole('option', { name: 'Initial' }));
    expect(onJump).toHaveBeenCalledWith(0);
  });

  it('jumps from the keyboard: arrows move, Enter jumps', () => {
    const onJump = vi.fn();
    render(<HistoryList entries={ENTRIES} current={2} onJump={onJump} />);
    const fill = screen.getByRole('option', { name: 'Fill' });
    expect(fill.tabIndex).toBe(0);
    act(() => fill.focus());
    fireEvent.keyDown(fill, { key: 'ArrowUp' });
    expect(onJump).not.toHaveBeenCalled();
    const draw = screen.getByRole('option', { name: 'Draw rect' });
    expect(draw).toHaveFocus();
    fireEvent.keyDown(draw, { key: 'Enter' });
    expect(onJump).toHaveBeenCalledWith(1);
  });

  it('dims the redoable entries', () => {
    render(<HistoryList entries={ENTRIES} current={0} onJump={() => {}} />);
    expect(screen.getByRole('option', { name: 'Fill' }).className).toMatch(/muted/);
    expect(screen.getByRole('option', { name: 'Initial' }).className).not.toMatch(/muted/);
  });

  it('takes a name of its own', () => {
    render(<HistoryList entries={ENTRIES} current={0} onJump={() => {}} aria-label="Undo steps" />);
    expect(screen.getByRole('listbox', { name: 'Undo steps' })).toBeInTheDocument();
  });

  it('shows its empty state when there are no entries', () => {
    render(<HistoryList entries={[]} current={0} onJump={() => {}} empty="Nothing yet" />);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
  });
});
