import { describe, expect, it } from 'vitest';
import { roundToCell } from '.';

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
