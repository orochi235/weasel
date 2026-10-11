import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tree, type TreeNode } from './Tree';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const NODES: readonly TreeNode[] = [
  { id: 'grid', label: 'Show grid', tooltip: 'Draw the grid.' },
  { id: 'snap', label: 'Snap' },
];

const row = (name: string) => screen.getByRole('treeitem', { name }).firstElementChild!;
const rest = () => act(() => { vi.advanceTimersByTime(600); });

describe('Tree row tooltips', () => {
  it('opens a row\'s tooltip once the pointer has rested on it, and closes it when the pointer leaves', () => {
    render(<Tree aria-label="Prefs" nodes={NODES} />);
    fireEvent.pointerEnter(row('Show grid'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    rest();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Draw the grid.');
    fireEvent.pointerLeave(row('Show grid'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens nothing for a row the pointer left before the rest was up, or one with no tooltip', () => {
    render(<Tree aria-label="Prefs" nodes={NODES} />);
    fireEvent.pointerEnter(row('Show grid'));
    fireEvent.pointerLeave(row('Show grid'));
    fireEvent.pointerEnter(row('Snap'));
    rest();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes the tooltip on a press', () => {
    render(<Tree aria-label="Prefs" nodes={NODES} />);
    fireEvent.pointerEnter(row('Show grid'));
    rest();
    fireEvent.pointerDown(row('Show grid'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('gives the item a string tooltip as its description', () => {
    render(<Tree aria-label="Prefs" nodes={NODES} />);
    expect(screen.getByRole('treeitem', { name: 'Show grid' })).toHaveAttribute('aria-description', 'Draw the grid.');
    expect(screen.getByRole('treeitem', { name: 'Snap' })).not.toHaveAttribute('aria-description');
  });
});
