import { describe, expect, it } from 'vitest';
import { roundToCell } from '.';
import { outlineBox } from './lattice';

describe('roundToCell', () => {
  it('snaps to nearest grid cell', () => {
    expect(roundToCell(2.3, 1)).toBe(2);
    expect(roundToCell(2.7, 1)).toBe(3);
    expect(roundToCell(2.5, 1)).toBe(3);
  });

  it('works with non-1 grid sizes', () => {
    expect(roundToCell(1.3, 0.5)).toBe(1.5);
    expect(roundToCell(1.1, 0.5)).toBe(1);
  });

  it('handles zero and negative', () => {
    expect(roundToCell(0, 1)).toBe(0);
    expect(roundToCell(-0.3, 1)).toBe(0);
    expect(roundToCell(-0.7, 1)).toBe(-1);
  });
});

describe('outlineBox', () => {
  it('boxes an outline of a million points without overflowing the call stack', () => {
    const outline = Array.from({ length: 1_000_000 }, (_, i) => ({ x: i % 1000, y: -(i % 7) }));
    expect(outlineBox(outline)).toEqual({ x: 0, y: -6, width: 999, height: 6 });
  });
});
