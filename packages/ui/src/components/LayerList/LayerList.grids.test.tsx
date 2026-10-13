import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayerList, type LayerListItem } from './LayerList';

const body = (ids: string[]) => (item: LayerListItem) => (ids.includes(item.id) ? <div>body of {item.id}</div> : null);
const labels = (grid: HTMLElement) => within(grid).getAllByRole('row').map((r) => r.textContent);
const levelOf = (label: string) =>
  (screen.getByText(label).closest('[role="row"]') as HTMLElement).getAttribute('aria-level');

function everyRowIsInOneGrid() {
  for (const row of screen.getAllByRole('row')) {
    const grid = row.closest('[role="treegrid"]');
    expect(grid, row.textContent ?? '').not.toBeNull();
    expect(grid!.parentElement!.closest('[role="treegrid"]')).toBeNull();
  }
}

describe('LayerList rows under a card', () => {
  const UNDER: LayerListItem[] = [
    {
      id: 'a',
      label: 'Alpha',
      children: [{ id: 'a1', label: 'One' }, { id: 'a2', label: 'Two', children: [{ id: 'a2x', label: 'Deep' }] }],
    },
    { id: 'b', label: 'Beta' },
  ];

  it('are a treegrid named for the card, with levels counted from it', () => {
    render(<LayerList items={UNDER} renderBody={body(['a', 'b'])} label="Fills" />);
    expect(labels(screen.getByRole('treegrid', { name: 'Alpha' }))).toEqual(['One', 'Two', 'Deep']);
    expect(screen.getAllByRole('treegrid')).toHaveLength(1);
    expect(levelOf('One')).toBe('1');
    expect(levelOf('Deep')).toBe('2');
    everyRowIsInOneGrid();
  });

  it('say they take a multi-selection when the list selects', () => {
    render(<LayerList items={UNDER} renderBody={body(['a', 'b'])} selectedIds={[]} onSelect={() => {}} />);
    expect(screen.getByRole('treegrid', { name: 'Alpha' })).toHaveAttribute('aria-multiselectable', 'true');
  });
});

describe('LayerList rows among cards', () => {
  const MIXED: LayerListItem[] = [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
    { id: 'c', label: 'Gamma', children: [{ id: 'c1', label: 'Inner' }] },
    { id: 'd', label: 'Delta' },
    { id: 'e', label: 'Epsilon' },
  ];

  it('put each run of rows in a treegrid named by the list', () => {
    render(<LayerList items={MIXED} renderBody={body(['a', 'd'])} label="Fills" />);
    const grids = screen.getAllByRole('treegrid', { name: 'Fills' });
    expect(grids.map(labels)).toEqual([['Beta', 'Gamma', 'Inner'], ['Epsilon']]);
    expect(levelOf('Beta')).toBe('1');
    expect(levelOf('Inner')).toBe('2');
    expect(levelOf('Epsilon')).toBe('1');
    everyRowIsInOneGrid();
  });

  it('name a run under a card for the card', () => {
    const items: LayerListItem[] = [{ id: 'p', label: 'Parent', children: MIXED }];
    render(<LayerList items={items} renderBody={body(['p', 'a', 'd'])} label="Fills" />);
    expect(screen.getAllByRole('treegrid', { name: 'Parent' }).map(labels)).toEqual([['Beta', 'Gamma', 'Inner'], ['Epsilon']]);
    expect(screen.queryByRole('treegrid', { name: 'Fills' })).toBeNull();
    everyRowIsInOneGrid();
  });
});

describe('LayerList drag among cards', () => {
  const ROW_H = 28;
  const realRect = Element.prototype.getBoundingClientRect;
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (!/_entry_/.test(this.className)) return realRect.call(this);
      const all = Array.from(document.querySelectorAll('[class*="_entry_"]'));
      const i = all.indexOf(this);
      return { x: 0, y: i * ROW_H, top: i * ROW_H, left: 0, right: 200, bottom: (i + 1) * ROW_H, width: 200, height: ROW_H } as DOMRect;
    };
  });
  afterEach(() => {
    Element.prototype.getBoundingClientRect = realRect;
  });

  const pointer = (target: EventTarget, type: string, clientY: number) => act(() => {
    target.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true, isPrimary: true, buttons: 1, clientX: 10, clientY }));
  });

  it('counts a row inside a run as one place in its level, not the run', () => {
    const items: LayerListItem[] = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
      { id: 'd', label: 'Delta' },
    ];
    const onReorder = vi.fn();
    render(<LayerList items={items} renderBody={body(['a'])} onReorder={onReorder} />);
    const row = screen.getByText('Delta').closest('[role="row"]') as HTMLElement;
    // Delta is the fourth entry (y 84..112); drop it on the upper half of Beta, the second (y 28..56).
    pointer(row, 'pointerdown', 98);
    pointer(row, 'pointermove', 32);
    pointer(row, 'pointerup', 32);
    expect(onReorder).toHaveBeenCalledWith({ ids: ['d'], parentId: null, index: 1 });
  });
});
