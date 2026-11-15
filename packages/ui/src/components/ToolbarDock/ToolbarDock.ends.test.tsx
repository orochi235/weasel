import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ToolbarDock } from './ToolbarDock';
import { dropAt, keyTarget, placeWords, type DockBox } from './dockDrop';
import { moveBar, resolveLayout, type DockBar, type DockSpec, type ToolbarLayout } from './layout';

const docks: DockSpec[] = [{ id: 'top', edge: 'top' }, { id: 'bottom', edge: 'bottom' }];
const bar = (id: string): DockBar => ({ id, label: id.toUpperCase(), docks: ['top', 'bottom'], render: () => <span>{id}</span> });
const bars = ['a', 'b', 'c', 'd'].map(bar);

describe('a row’s far end', () => {
  it('keeps end bars after start bars, and only for bars still docked', () => {
    const stored: ToolbarLayout = { docks: { top: [['c', 'a', 'b']] }, floating: {}, atEnd: ['c', 'gone'] };
    expect(resolveLayout(docks, bars, stored)).toEqual({ docks: { top: [['a', 'b', 'd', 'c']], bottom: [] }, floating: {}, atEnd: ['c'] });
  });

  it('leaves `atEnd` out of a layout where no bar sits at a far end', () => {
    expect(resolveLayout(docks, bars, undefined)).not.toHaveProperty('atEnd');
  });

  it('moves a bar into a row’s end bars, and out again to the start', () => {
    const was = resolveLayout(docks, bars, { docks: { top: [['a', 'b', 'c']] }, floating: {} });
    const ended = moveBar(was, 'a', { dock: 'top', row: 0, index: 2, end: true });
    expect(ended.docks.top).toEqual([['b', 'c', 'd', 'a']]);
    expect(ended.atEnd).toEqual(['a']);
    const back = moveBar(ended, 'a', { dock: 'bottom', row: 0, index: 0, newRow: true });
    expect(back.docks.bottom).toEqual([['a']]);
    expect(back).not.toHaveProperty('atEnd');
  });

  describe('dropAt', () => {
    const row = (bars: DockBox['rows'][number]['bars']): DockBox[] => [{ id: 'top', edge: 'top', vertical: false, along: [0, 1000], rows: [{ start: 0, end: 40, from: 0, to: 1000, bars }] }];
    const one = row([{ id: 'a', at: 100, end: false }]);
    const both = row([{ id: 'a', at: 100, end: false }, { id: 'e', at: 900, end: true }]);

    it('joins the far end past the middle of a row’s open length, marking the row’s end', () => {
      expect(dropAt(one, bar('b'), { clientX: 800, clientY: 20 })).toEqual({ target: { dock: 'top', row: 0, index: 1, end: true }, mark: { dock: 'top', row: 0, at: 'end' } });
    });

    it('stays among the start bars short of that middle', () => {
      expect(dropAt(one, bar('b'), { clientX: 300, clientY: 20 })).toEqual({ target: { dock: 'top', row: 0, index: 1 }, mark: { bar: 'a', side: 'after' } });
    });

    it('between the two ends, joins the one nearer the pointer', () => {
      expect(dropAt(both, bar('b'), { clientX: 600, clientY: 20 })).toEqual({ target: { dock: 'top', row: 0, index: 1, end: true }, mark: { bar: 'e', side: 'before' } });
      expect(dropAt(both, bar('b'), { clientX: 400, clientY: 20 })).toEqual({ target: { dock: 'top', row: 0, index: 1 }, mark: { bar: 'a', side: 'after' } });
    });

    it('past the last end bar, lands after it', () => {
      expect(dropAt(both, bar('b'), { clientX: 950, clientY: 20 })).toEqual({ target: { dock: 'top', row: 0, index: 2, end: true }, mark: { bar: 'e', side: 'after' } });
    });

    it('marks a row’s start where no start bar is left to drop beside', () => {
      const ends = row([{ id: 'e', at: 900, end: true }]);
      expect(dropAt(ends, bar('b'), { clientX: 100, clientY: 20 })?.mark).toEqual({ dock: 'top', row: 0, at: 'start' });
    });
  });

  describe('Alt+arrows', () => {
    const layout = resolveLayout(docks, bars, { docks: { top: [['a', 'b', 'c'], ['d']] }, floating: {}, atEnd: ['c'] });
    const press = (from: ToolbarLayout, id: string, key: string) => {
      const to = keyTarget(from, docks, bar(id), key);
      return to && moveBar(from, id, to);
    };

    it('crosses from the last start bar to the far end, and back', () => {
      const ended = press(layout, 'b', 'ArrowRight')!;
      expect(ended.docks.top![0]).toEqual(['a', 'b', 'c']);
      expect(ended.atEnd).toEqual(['b', 'c']);
      expect(placeWords(ended, docks, bar('b'))).toBe('B toolbar, row 1, position 2 of 3, at the end');
      const back = press(ended, 'b', 'ArrowLeft')!;
      expect(back.atEnd).toEqual(['c']);
    });

    it('stops at the row’s far edge', () => {
      expect(keyTarget(layout, docks, bar('c'), 'ArrowRight')).toBeNull();
    });

    it('keeps an end bar at the far end of the row it moves to', () => {
      const down = press(layout, 'c', 'ArrowDown')!;
      expect(down.docks.top).toEqual([['a', 'b'], ['d', 'c']]);
      expect(down.atEnd).toEqual(['c']);
    });

    it('keeps a start bar at its place among the start bars of the row it moves to', () => {
      const up = press(layout, 'd', 'ArrowUp')!;
      expect(up.docks.top).toEqual([['d', 'a', 'b', 'c']]);
    });
  });

  it('draws the end bars after an open length that pushes them to the far end', () => {
    const { container } = render(<ToolbarDock docks={docks} bars={bars} layout={{ docks: { top: [['a', 'b', 'c', 'd']] }, floating: {}, atEnd: ['c', 'd'] }} />);
    const row = container.querySelector('[data-dock-row="0"]')!;
    const parts = Array.from(row.children, (el) => el.getAttribute('data-dock-bar') ?? (el.hasAttribute('data-dock-end') ? 'end?' : 'spring'));
    expect(parts).toEqual(['a', 'b', 'spring', 'c', 'd']);
    expect(Array.from(row.querySelectorAll('[data-dock-end]'), (el) => el.getAttribute('data-dock-bar'))).toEqual(['c', 'd']);
  });
});
