import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HistoryList } from './HistoryList';

afterEach(() => { cleanup(); });

const ITEMS = [
  { id: '__initial__', label: 'Initial' },
  { id: '1', label: 'Draw rect' },
  { id: '2', label: 'Fill' },
];

describe('HistoryList', () => {
  it('is a single-select listbox with the current state selected', () => {
    render(<HistoryList items={ITEMS} currentIndex={1} onJump={() => {}} />);
    expect(screen.getByRole('listbox', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Draw rect' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Fill' })).toHaveAttribute('aria-selected', 'false');
  });

  it('jumps to a clicked entry', () => {
    const onJump = vi.fn();
    render(<HistoryList items={ITEMS} currentIndex={2} onJump={onJump} />);
    fireEvent.click(screen.getByRole('option', { name: 'Initial' }));
    expect(onJump).toHaveBeenCalledWith(0);
  });

  it('jumps from the keyboard: arrows move, Enter jumps', () => {
    const onJump = vi.fn();
    render(<HistoryList items={ITEMS} currentIndex={2} onJump={onJump} />);
    const fill = screen.getByRole('option', { name: 'Fill' });
    expect(fill.tabIndex).toBe(0);
    fill.focus();
    fireEvent.keyDown(fill, { key: 'ArrowUp' });
    expect(onJump).not.toHaveBeenCalled();
    const draw = screen.getByRole('option', { name: 'Draw rect' });
    expect(draw).toHaveFocus();
    fireEvent.keyDown(draw, { key: 'Enter' });
    expect(onJump).toHaveBeenCalledWith(1);
  });

  it('dims the redoable entries', () => {
    render(<HistoryList items={ITEMS} currentIndex={0} onJump={() => {}} />);
    expect(screen.getByRole('option', { name: 'Fill' }).className).toMatch(/muted/);
    expect(screen.getByRole('option', { name: 'Initial' }).className).not.toMatch(/muted/);
  });
});
