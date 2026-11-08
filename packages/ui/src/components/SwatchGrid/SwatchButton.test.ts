import { describe, expect, it } from 'vitest';
import { nextSwatch } from './SwatchButton';

describe('nextSwatch', () => {
  it('moves up and down by a row when the last row sits at the start', () => {
    expect(nextSwatch('ArrowDown', 2, 13, 10)).toBe(12);
    expect(nextSwatch('ArrowUp', 12, 13, 10)).toBe(2);
  });

  it('moves to the swatch beneath in an end-aligned last row, and back', () => {
    expect(nextSwatch('ArrowDown', 8, 13, 10, 14)).toBe(11);
    expect(nextSwatch('ArrowUp', 11, 13, 10, 14)).toBe(8);
  });

  it('pairs a column with a half-shifted swatch both ways in a centered last row', () => {
    // Three swatches in ten columns start 3.5 columns in, covering 3.5–4.5, 4.5–5.5 and 5.5–6.5.
    for (const [above, below] of [[4, 11], [5, 12]] as const) {
      expect(nextSwatch('ArrowDown', above, 13, 10, 7)).toBe(below);
      expect(nextSwatch('ArrowUp', below, 13, 10, 7)).toBe(above);
    }
    expect(nextSwatch('ArrowDown', 3, 13, 10, 7)).toBe(10);
    expect(nextSwatch('ArrowDown', 6, 13, 10, 7)).toBe(12);
  });

  it('goes to the nearest swatch of a short last row with none beneath, as every roving grid does', () => {
    expect(nextSwatch('ArrowDown', 5, 13, 10)).toBe(12);
    expect(nextSwatch('ArrowDown', 2, 13, 10, 14)).toBe(10);
    expect(nextSwatch('ArrowDown', 2, 13, 10, 7)).toBe(10);
    expect(nextSwatch('ArrowDown', 7, 13, 10, 7)).toBe(12);
  });

  it('stays put at the top and bottom rows', () => {
    expect(nextSwatch('ArrowUp', 3, 13, 10)).toBe(3);
    expect(nextSwatch('ArrowDown', 11, 13, 10)).toBe(11);
  });
});
