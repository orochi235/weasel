import { describe, expect, it } from 'vitest';
import { gridLayout, rovingGridTarget, tileGrid, tileKey, tileRows, type Tiling } from './grid';

describe('tileGrid', () => {
  it('puts the spare columns of a short last row before it, in half-column tracks', () => {
    expect(tileGrid(13, { columns: 10, lastRow: 'start' }).lead).toBe(0);
    expect(tileGrid(13, { columns: 10, lastRow: 'center' }).lead).toBe(7);
    expect(tileGrid(13, { columns: 10, lastRow: 'end' }).lead).toBe(14);
    expect(tileGrid(20, { columns: 10, lastRow: 'end' }).lead).toBe(0);
  });

  it('lays the grid in half-column tracks', () => {
    const g = tileGrid(7, { columns: 4, lastRow: 'center' });
    expect([g.tracks, g.span, g.fillSpan, g.lead]).toEqual([8, 2, 2, 1]);
  });

  it('stretches a short last row across the whole row on tracks both rows divide', () => {
    // Four across, then three: twelve tracks, three to a full row's item and four to a stretched one's.
    const g = tileGrid(7, { columns: 4, lastRow: 'fill' });
    expect([g.tracks, g.span, g.fillSpan, g.lead]).toEqual([12, 3, 4, 0]);
    expect(Array.from({ length: 7 }, (_, i) => g.stretched(i))).toEqual([false, false, false, false, true, true, true]);
  });

  it('names the outer corners of the grid each item sits on', () => {
    const corners = (count: number, t: Tiling) => {
      const g = tileGrid(count, t);
      return Array.from({ length: count }, (_, i) => g.corners(i).join(' '));
    };
    expect(corners(6, { columns: 3 })).toEqual(['ss', '', 'se', 'es', '', 'ee']);
    expect(corners(5, { columns: 3, lastRow: 'fill' })).toEqual(['ss', '', 'se', 'es', 'ee']);
    // A short row at the start leaves the bottom-right corner empty; a centered one leaves both bottom corners empty.
    expect(corners(5, { columns: 3 })).toEqual(['ss', '', 'se', 'es', '']);
    expect(corners(4, { columns: 3, lastRow: 'center' })).toEqual(['ss', '', 'se', '']);
    expect(corners(3, { columns: 3 })).toEqual(['ss es', '', 'se ee']);
    // One short row is the grid's top and bottom both, so its offset and its end hold on either.
    expect(corners(2, { columns: 3 })).toEqual(['ss es', '']);
    expect(corners(2, { columns: 3, lastRow: 'end' })).toEqual(['', 'se ee']);
    expect(corners(2, { columns: 4, lastRow: 'center' })).toEqual(['', '']);
    expect(corners(2, { columns: 3, lastRow: 'fill' })).toEqual(['ss es', 'se ee']);
  });
});

describe('gridLayout', () => {
  it('offsets a short row and widens a stretched one', () => {
    expect(gridLayout([[0, 1, 2, 3], [4, 5]], 4, 'center')).toEqual({ offsets: [0, 1], widths: [1, 1] });
    expect(gridLayout([[0, 1, 2, 3], [4, 5]], 4, 'fill')).toEqual({ offsets: [0, 0], widths: [1, 2] });
  });
});

describe('rovingGridTarget', () => {
  // a b c
  // d e f
  // g
  const rows = [[0, 1, 2], [3, 4, 5], [6]];
  const all = Array(7).fill(true) as boolean[];

  it('moves a row on Up and Down, keeping the column', () => {
    expect(rovingGridTarget(1, 'ArrowDown', all, rows)).toBe(4);
    expect(rovingGridTarget(4, 'ArrowUp', all, rows)).toBe(1);
  });

  it('goes to the last item of a short row the column runs past', () => {
    expect(rovingGridTarget(5, 'ArrowDown', all, rows)).toBe(6);
    expect(rovingGridTarget(4, 'ArrowDown', all, rows)).toBe(6);
  });

  it('stops at the top and bottom rows rather than wrapping', () => {
    expect(rovingGridTarget(1, 'ArrowUp', all, rows)).toBeNull();
    expect(rovingGridTarget(6, 'ArrowDown', all, rows)).toBeNull();
  });

  it('steps Left and Right in reading order, across rows, wrapping at the ends', () => {
    expect(rovingGridTarget(2, 'ArrowRight', all, rows)).toBe(3);
    expect(rovingGridTarget(3, 'ArrowLeft', all, rows)).toBe(2);
    expect(rovingGridTarget(6, 'ArrowRight', all, rows)).toBe(0);
    expect(rovingGridTarget(0, 'ArrowLeft', all, rows)).toBe(6);
  });

  it('passes over a row whose item in that column is disabled', () => {
    const enabled = all.map((_, i) => i !== 4);
    expect(rovingGridTarget(1, 'ArrowDown', enabled, rows)).toBe(6);
  });

  it('keeps Home and End on the whole set', () => {
    expect(rovingGridTarget(4, 'Home', all, rows)).toBe(0);
    expect(rovingGridTarget(4, 'End', all, rows)).toBe(6);
  });

  it('moves to the item drawn under this one in a row that sits off the start', () => {
    // a b c d
    //  e f     <- two items centered in four columns: one column in
    const grid = [[0, 1, 2, 3], [4, 5]];
    const six = Array(6).fill(true) as boolean[];
    const layout = { offsets: [0, 1] };
    expect(rovingGridTarget(1, 'ArrowDown', six, grid, layout)).toBe(4);
    expect(rovingGridTarget(2, 'ArrowDown', six, grid, layout)).toBe(5);
    expect(rovingGridTarget(5, 'ArrowUp', six, grid, layout)).toBe(2);
    expect(rovingGridTarget(0, 'ArrowDown', six, grid, layout)).toBe(4);
    expect(rovingGridTarget(3, 'ArrowDown', six, grid, layout)).toBe(5);
  });

  it('moves to the stretched item that covers most of this one, and back', () => {
    // a b c d
    // e   f      <- two items stretched across four columns, two each
    const grid = [[0, 1, 2, 3], [4, 5]];
    const six = Array(6).fill(true) as boolean[];
    const layout = { widths: [1, 2] };
    expect(rovingGridTarget(1, 'ArrowDown', six, grid, layout)).toBe(4);
    expect(rovingGridTarget(2, 'ArrowDown', six, grid, layout)).toBe(5);
    expect(rovingGridTarget(4, 'ArrowUp', six, grid, layout)).toBe(0);
    expect(rovingGridTarget(5, 'ArrowUp', six, grid, layout)).toBe(2);
  });
});

describe('rovingGridTarget — right-to-left', () => {
  const rows = [[0, 1, 2], [3, 4, 5]];
  const all = Array(6).fill(true) as boolean[];

  it('swaps Left and Right and keeps Up and Down', () => {
    expect(rovingGridTarget(2, 'ArrowLeft', all, rows, { dir: 'rtl' })).toBe(3);
    expect(rovingGridTarget(3, 'ArrowRight', all, rows, { dir: 'rtl' })).toBe(2);
    expect(rovingGridTarget(1, 'ArrowDown', all, rows, { dir: 'rtl' })).toBe(4);
  });
});

describe('tileRows', () => {
  it('splits a run into rows in reading order, the last one short', () => {
    expect(tileRows(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
  });

  it('reads a column count below one, or not a number, as one, and a fractional one as its whole part', () => {
    for (const columns of [0, -2, NaN]) expect(tileRows(3, columns)).toEqual([[0], [1], [2]]);
    expect(tileRows(5, 2.5)).toEqual([[0, 1], [2, 3], [4]]);
    expect(tileKey(0, 'ArrowDown', 3, { columns: 0 })).toBe(1);
    expect(tileGrid(3, { columns: 0 })).toMatchObject({ tracks: 2, span: 2, lastStart: 2 });
  });
});

describe('tileKey', () => {
  it('moves up and down by a row when the last row sits at the start', () => {
    expect(tileKey(2, 'ArrowDown', 13, { columns: 10, lastRow: 'start' })).toBe(12);
    expect(tileKey(12, 'ArrowUp', 13, { columns: 10, lastRow: 'start' })).toBe(2);
  });

  it('moves to the swatch beneath in an end-aligned last row, and back', () => {
    expect(tileKey(8, 'ArrowDown', 13, { columns: 10, lastRow: 'end' })).toBe(11);
    expect(tileKey(11, 'ArrowUp', 13, { columns: 10, lastRow: 'end' })).toBe(8);
  });

  it('pairs a column with a half-shifted swatch both ways in a centered last row', () => {
    // Three swatches in ten columns start 3.5 columns in, covering 3.5–4.5, 4.5–5.5 and 5.5–6.5.
    for (const [above, below] of [[4, 11], [5, 12]] as const) {
      expect(tileKey(above, 'ArrowDown', 13, { columns: 10, lastRow: 'center' })).toBe(below);
      expect(tileKey(below, 'ArrowUp', 13, { columns: 10, lastRow: 'center' })).toBe(above);
    }
    expect(tileKey(3, 'ArrowDown', 13, { columns: 10, lastRow: 'center' })).toBe(10);
    expect(tileKey(6, 'ArrowDown', 13, { columns: 10, lastRow: 'center' })).toBe(12);
  });

  it('goes to the nearest swatch of a short last row with none beneath, as every roving grid does', () => {
    expect(tileKey(5, 'ArrowDown', 13, { columns: 10, lastRow: 'start' })).toBe(12);
    expect(tileKey(2, 'ArrowDown', 13, { columns: 10, lastRow: 'end' })).toBe(10);
    expect(tileKey(2, 'ArrowDown', 13, { columns: 10, lastRow: 'center' })).toBe(10);
    expect(tileKey(7, 'ArrowDown', 13, { columns: 10, lastRow: 'center' })).toBe(12);
  });

  it('does not move from the top row up or the bottom row down', () => {
    expect(tileKey(3, 'ArrowUp', 13, { columns: 10, lastRow: 'start' })).toBeNull();
    expect(tileKey(11, 'ArrowDown', 13, { columns: 10, lastRow: 'start' })).toBeNull();
  });
});
