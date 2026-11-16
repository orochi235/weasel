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

  it('scrolls the current entry into view in its own px when an ancestor draws the list at twice its size', () => {
    const view = render(<HistoryList entries={ENTRIES} current={0} onJump={() => {}} />);
    const box = view.container.firstElementChild as HTMLElement;
    const row = box.querySelector<HTMLElement>('[data-row-index="2"]')!;
    for (const [k, v] of Object.entries({ offsetWidth: 100, offsetHeight: 50, clientHeight: 50 })) Object.defineProperty(box, k, { value: v });
    Object.defineProperty(row, 'offsetHeight', { value: 20 });
    box.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 200, height: 100 });
    row.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 200, width: 200, height: 40 });
    view.rerender(<HistoryList entries={ENTRIES} current={2} onJump={() => {}} />);
    expect(box.scrollTop).toBe(70);
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
