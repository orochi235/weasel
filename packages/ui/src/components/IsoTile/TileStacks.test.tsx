import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TileItem } from './IsoTile';
import { TileStacks, type TileStacksProps } from './TileStacks';
import { defaultTicksFor, stacksLayoutFor } from './tileStacksLayout';

const COLUMNS: TileItem[][] = [
  [{ key: 'a', tone: 'new', title: 'a first' }, { key: 'b', tone: 'new' }],
  [],
  [{ key: 'a', tone: 'again', title: 'a again' }],
];
const SIZES = { pitch: 38, tileWidth: 28, tileHeight: 7, depth: 8, trailingWidth: 0 };

const draw = (props: Partial<TileStacksProps> = {}) => render(<TileStacks aria-label="Passes" columns={COLUMNS} {...props} />);
const tiles = (root: HTMLElement) => [...root.querySelectorAll<SVGGElement>('svg > g')];
const traced = (root: HTMLElement) => tiles(root).map((g) => g.hasAttribute('data-traced'));

describe('stacksLayoutFor', () => {
  it('stacks each column bottom to top from the baseline, one pitch apart', () => {
    const layout = stacksLayoutFor(COLUMNS, 3, SIZES);
    expect(layout.base).toBe(8 + 2 * 7 + 2);
    expect(layout.tiles.map((t) => [t.item.key, t.column, t.x, t.y])).toEqual([
      ['a', 1, 0, 17], ['b', 1, 0, 10], ['a', 3, 76, 17],
    ]);
    expect(layout.empties).toEqual([{ column: 2, x: 38 }]);
  });

  it('spans the axis past the last column, and widens for a trailing label', () => {
    expect(stacksLayoutFor(COLUMNS, 10, SIZES).width).toBe(380);
    expect(stacksLayoutFor(COLUMNS, 3, { ...SIZES, trailingWidth: 120 }).width).toBe(3 * 38 + 6 + 120);
  });

  it('labels the first column and every fifth', () => {
    expect(defaultTicksFor(3)).toEqual([1]);
    expect(defaultTicksFor(12)).toEqual([1, 5, 10]);
  });
});

describe('TileStacks', () => {
  it('draws a tile per item and names the chart', () => {
    const { container } = draw();
    expect(screen.getByRole('img', { name: 'Passes' })).toBeInTheDocument();
    expect(tiles(container)).toHaveLength(3);
    expect(tiles(container)[0]!.classList.contains('new')).toBe(true);
    expect(tiles(container)[0]!.querySelector('title')?.textContent).toBe('a first');
  });

  it('becomes a group of tile buttons when tiles can be picked, tracing the focused one', () => {
    const pick = vi.fn();
    const trace = vi.fn();
    draw({ onPick: pick, onTrace: trace });
    expect(screen.getByRole('group', { name: 'Passes' })).toBeInTheDocument();
    const first = screen.getByRole('button', { name: 'a first' });
    fireEvent.focus(first);
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(trace).toHaveBeenCalledWith('a');
    expect(pick).toHaveBeenCalledWith('a');
  });

  it('patches an empty column unless told not to, with its hover text', () => {
    const { container } = draw({ emptyTitle: (c) => `column ${c} empty` });
    expect(container.querySelectorAll('svg > polygon')).toHaveLength(1);
    expect(container.querySelector('svg > polygon title')?.textContent).toBe('column 2 empty');
    expect(draw({ showEmpty: false }).container.querySelectorAll('svg > polygon')).toHaveLength(0);
  });

  it('labels the ticks it is given, and a trailing label', () => {
    draw({ ticks: [1, 3], trailing: '≈ 35 not found yet' });
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('≈ 35 not found yet')).toBeInTheDocument();
  });

  it('traces a hovered key across every column on its own, and clears it on leave', () => {
    const onTrace = vi.fn();
    const { container } = draw({ onTrace });
    fireEvent.pointerEnter(tiles(container)[2]!);
    expect(traced(container)).toEqual([true, false, true]);
    expect(container.querySelector('svg')!.getAttribute('class')).toMatch(/tracing/);
    fireEvent.pointerLeave(tiles(container)[2]!);
    expect(traced(container)).toEqual([false, false, false]);
    expect(onTrace.mock.calls).toEqual([['a'], [null]]);
  });

  it('shows the trace it is given, and fades nothing for a key it does not hold', () => {
    const { container, rerender } = draw({ traced: 'b' });
    expect(traced(container)).toEqual([false, true, false]);
    rerender(<TileStacks aria-label="Passes" columns={COLUMNS} traced="zzz" />);
    expect(container.querySelector('svg')!.getAttribute('class')).not.toMatch(/tracing/);
  });

  it('shares one trace with another chart through traced and onTrace', () => {
    function Pair() {
      const [key, setKey] = useState<string | null>(null);
      return <><TileStacks aria-label="one" columns={COLUMNS} traced={key} onTrace={setKey} /><TileStacks aria-label="two" columns={COLUMNS} traced={key} onTrace={setKey} /></>;
    }
    const { container } = render(<Pair />);
    const [one, two] = [...container.querySelectorAll('svg')];
    fireEvent.pointerEnter(one!.querySelector('g')!);
    expect([...two!.querySelectorAll(':scope > g')].map((g) => g.hasAttribute('data-traced'))).toEqual([true, false, true]);
  });

  it('passes a clicked tile\'s key to onPick', () => {
    const onPick = vi.fn();
    const { container } = draw({ onPick });
    fireEvent.click(tiles(container)[1]!);
    expect(onPick).toHaveBeenCalledWith('b');
  });
});
