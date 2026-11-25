import { describe, expect, it } from 'vitest';
import { dropAt, measureDocks, type DockBox } from './dockDrop';
import type { DockBar } from './layout';

const top: DockBox = { id: 'top', edge: 'top', vertical: false, mirrored: false, along: [0, 1000], rows: [{ start: 0, end: 40, from: 0, to: 1000, bars: [{ id: 't1', at: 100, end: false }] }] };
const left: DockBox = { id: 'left', edge: 'left', vertical: true, mirrored: false, along: [40, 800], rows: [{ start: 0, end: 40, from: 40, to: 800, bars: [{ id: 'l1', at: 100, end: false }] }] };
const bar: DockBar = { id: 'b', label: 'B', docks: ['top', 'left'], vertical: true, render: () => null };

describe('dropAt', () => {
  it('drops into a side dock at its top edge rather than a new row of the top dock above it', () => {
    expect(dropAt([top, left], bar, { clientX: 20, clientY: 50 })?.target).toEqual({ dock: 'left', row: 0, index: 0 });
  });

  it('still opens a new top row in the half-row zone past the side docks', () => {
    expect(dropAt([top, left], bar, { clientX: 500, clientY: 50 })?.target).toEqual({ dock: 'top', row: 1, index: 0, newRow: true });
  });

  it('gives a point over a dock row the bar may not enter no drop, even inside another dock’s zone', () => {
    expect(dropAt([top, left], { ...bar, docks: ['top'] }, { clientX: 20, clientY: 50 })).toBeNull();
  });

  it('passes over the new-row zone of a dock the bar may not enter to one it may', () => {
    const below = { ...left, rows: [{ ...left.rows[0]!, start: 0, end: 40 }], along: [0, 800] as const };
    expect(dropAt([top, below], { ...bar, docks: ['left'] }, { clientX: 50, clientY: 50 })?.target).toEqual({ dock: 'left', row: 1, index: 0, newRow: true });
  });

  it('drops before the only bar of a right-to-left row with the pointer on its right', () => {
    const rtl: DockBox = { ...top, rows: [{ start: 0, end: 40, from: 1000, to: 0, bars: [{ id: 't1', at: 500, end: false }] }] };
    expect(dropAt([rtl], bar, { clientX: 700, clientY: 20 })?.mark).toEqual({ bar: 't1', side: 'before' });
    expect(dropAt([rtl], bar, { clientX: 300, clientY: 20 })?.mark).toEqual({ bar: 't1', side: 'after' });
  });

  it('drops across the columns of a right-to-left left dock, which run from the right', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-dock="left" style="direction: rtl"><div data-dock-row="0"><div data-dock-bar="l1">x</div></div><div data-dock-row="1"><div data-dock-bar="l2">x</div></div></div>';
    const rect = (left: number, right: number) => ({ left, right, top: 0, bottom: 800, x: left, y: 0, width: right - left, height: 800, toJSON: () => {} }) as DOMRect;
    const [col0, col1] = root.querySelectorAll<HTMLElement>('[data-dock-row]');
    root.querySelector<HTMLElement>('[data-dock]')!.getBoundingClientRect = () => rect(0, 80);
    col0!.getBoundingClientRect = () => rect(40, 80);
    col1!.getBoundingClientRect = () => rect(0, 40);
    document.body.append(root);
    const boxes = measureDocks(root, [{ id: 'left', edge: 'left' }]);
    root.remove();
    expect(dropAt(boxes, bar, { clientX: 60, clientY: 400 })?.target).toMatchObject({ dock: 'left', row: 0 });
    expect(dropAt(boxes, bar, { clientX: 20, clientY: 400 })?.target).toMatchObject({ dock: 'left', row: 1 });
    expect(dropAt(boxes, bar, { clientX: 90, clientY: 400 })?.target).toEqual({ dock: 'left', row: 0, index: 0, newRow: true });
  });
});
