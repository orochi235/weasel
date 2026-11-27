import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { outlineOf } from './isoGeometry';
import { TileShelf, type TileShelfProps } from './TileShelf';
import { shelfLayoutFor, type TileShelfGroup } from './tileShelfLayout';

const GROUPS: TileShelfGroup[] = [
  { key: 'b1', label: 'b1', items: [{ key: 'd1', tone: 'fixed', title: 'd1 fixed' }, { key: 'd2', marked: true }] },
  { key: 'done', label: 'done', items: [{ key: 'd3' }] },
];
const SIZES = { tileWidth: 7, gap: 2, groupGap: 14, depth: 6 };

const draw = (props: Partial<TileShelfProps> = {}) => render(<TileShelf aria-label="Fixes" groups={GROUPS} {...props} />);
const groups = (root: HTMLElement) => [...root.querySelectorAll<SVGGElement>('svg > g')];
const tiles = (root: HTMLElement) => [...root.querySelectorAll<SVGGElement>('svg > g > g')];

describe('shelfLayoutFor', () => {
  it('lays tiles a gap apart, groups a group gap apart, each label centered under its group', () => {
    const layout = shelfLayoutFor(GROUPS, SIZES);
    expect(layout.groups.map((g) => g.tiles.map((t) => t.x))).toEqual([[0, 9], [36]]);
    expect(layout.groups.map((g) => g.labelX)).toEqual([(0 + 22) / 2, (36 + 49) / 2]);
    expect(layout.width).toBe(49);
  });

  it('is empty with no groups', () => {
    expect(shelfLayoutFor([], SIZES).width).toBe(0);
  });
});

describe('TileShelf', () => {
  it('draws a tile per item under its group label, and names the shelf', () => {
    const { container } = draw();
    expect(screen.getByRole('img', { name: 'Fixes' })).toBeInTheDocument();
    expect(tiles(container)).toHaveLength(3);
    expect(screen.getByText('done')).toBeInTheDocument();
    expect(tiles(container)[0]!.classList.contains('fixed')).toBe(true);
    expect(tiles(container)[0]!.querySelector('title')?.textContent).toBe('d1 fixed');
  });

  it('puts a dot above a marked tile only', () => {
    const { container } = draw();
    expect(tiles(container).map((g) => g.querySelector('circle') !== null)).toEqual([false, true, false]);
  });

  it('traces a hovered tile: its group keeps color and it alone is outlined, drawn after every tile', () => {
    const onTrace = vi.fn();
    const { container } = draw({ onTrace });
    fireEvent.pointerEnter(tiles(container)[1]!);
    expect(groups(container).map((g) => g.hasAttribute('data-traced'))).toEqual([true, false]);
    expect(tiles(container).map((g) => g.hasAttribute('data-traced'))).toEqual([false, true, false]);
    const outline = container.querySelector('svg')!.lastElementChild!;
    expect(outline.getAttribute('points')).toBe(outlineOf({ x: 9, y: 12, width: 7, height: 26, depth: 6 }));
    fireEvent.pointerLeave(tiles(container)[1]!);
    expect(onTrace.mock.calls).toEqual([['d2'], [null]]);
    expect(container.querySelector('svg')!.lastElementChild!.tagName).toBe('g');
  });

  it('fades and outlines nothing for a traced key it does not hold', () => {
    const { container } = draw({ traced: 'elsewhere' });
    expect(container.querySelector('svg')!.getAttribute('class')).not.toMatch(/tracing/);
    expect(container.querySelector('svg > polygon')).toBeNull();
  });

  it('passes a clicked tile\'s key to onPick', () => {
    const onPick = vi.fn();
    const { container } = draw({ onPick });
    fireEvent.click(tiles(container)[2]!);
    expect(onPick).toHaveBeenCalledWith('d3');
  });
});
