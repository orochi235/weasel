import { describe, expect, it } from 'vitest';
import { dropAt, type DockBox } from './dockDrop';
import type { DockBar } from './layout';

const top: DockBox = { id: 'top', edge: 'top', vertical: false, along: [0, 1000], rows: [{ start: 0, end: 40, bars: [{ id: 't1', at: 100 }] }] };
const left: DockBox = { id: 'left', edge: 'left', vertical: true, along: [40, 800], rows: [{ start: 0, end: 40, bars: [{ id: 'l1', at: 100 }] }] };
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
});
