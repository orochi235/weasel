import { describe, expect, it } from 'vitest';
import { nextSwatch, rowLead } from './SwatchButton';

describe('rowLead', () => {
  it('puts the spare columns of a short last row before it, in half-columns', () => {
    expect(rowLead(13, 10, 'start')).toBe(0);
    expect(rowLead(13, 10, 'center')).toBe(7);
    expect(rowLead(13, 10, 'end')).toBe(14);
    expect(rowLead(20, 10, 'end')).toBe(0);
  });
});

describe('nextSwatch', () => {
  it('moves up and down by a row when the last row sits at the start', () => {
    expect(nextSwatch('ArrowDown', 2, 13, 10)).toBe(12);
    expect(nextSwatch('ArrowDown', 5, 13, 10)).toBe(5);
    expect(nextSwatch('ArrowUp', 12, 13, 10)).toBe(2);
  });

  it('moves to the swatch beneath in an end-aligned last row, and back', () => {
    expect(nextSwatch('ArrowDown', 8, 13, 10, 14)).toBe(11);
    expect(nextSwatch('ArrowUp', 11, 13, 10, 14)).toBe(8);
    expect(nextSwatch('ArrowDown', 2, 13, 10, 14)).toBe(2);
  });

  it('pairs a column with a half-shifted swatch both ways in a centered last row', () => {
    // Three swatches in ten columns start 3.5 columns in, covering 3.5–4.5, 4.5–5.5 and 5.5–6.5.
    for (const [above, below] of [[4, 11], [5, 12]] as const) {
      expect(nextSwatch('ArrowDown', above, 13, 10, 7)).toBe(below);
      expect(nextSwatch('ArrowUp', below, 13, 10, 7)).toBe(above);
    }
    expect(nextSwatch('ArrowDown', 3, 13, 10, 7)).toBe(10);
    expect(nextSwatch('ArrowDown', 6, 13, 10, 7)).toBe(12);
    expect(nextSwatch('ArrowDown', 2, 13, 10, 7)).toBe(2);
    expect(nextSwatch('ArrowDown', 7, 13, 10, 7)).toBe(7);
  });
});
