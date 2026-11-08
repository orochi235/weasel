import { describe, expect, it } from 'vitest';
import { tiling } from './tiling';

const attrsOf = (count: number, t: Parameters<typeof tiling>[1]) => {
  const tiles = tiling(count, t);
  return Array.from({ length: count }, (_, i) => tiles.item(i));
};

describe('tiling', () => {
  it('puts the spare columns of a short last row before it, in half-columns', () => {
    expect(tiling(13, { columns: 10, lastRow: 'start' }).lead).toBe(0);
    expect(tiling(13, { columns: 10, lastRow: 'center' }).lead).toBe(7);
    expect(tiling(13, { columns: 10, lastRow: 'end' }).lead).toBe(14);
    expect(tiling(20, { columns: 10, lastRow: 'end' }).lead).toBe(0);
  });

  it('marks the item that starts an offset last row, and none otherwise', () => {
    expect(attrsOf(13, { columns: 10, lastRow: 'center' })[10]).toHaveProperty('data-row-lead');
    expect(attrsOf(13, { columns: 10 }).some((a) => 'data-row-lead' in a)).toBe(false);
  });

  it('lays the grid in half-column tracks', () => {
    expect(tiling(7, { columns: 4, lastRow: 'center' }).style)
      .toEqual({ '--tracks': 8, '--span': 2, '--fill-span': 2, '--lead': 1 });
  });

  it('stretches a short last row across the whole row on tracks both rows divide', () => {
    // Four across, then three: twelve tracks, three to a full row's item and four to a stretched one's.
    expect(tiling(7, { columns: 4, lastRow: 'fill' }).style)
      .toEqual({ '--tracks': 12, '--span': 3, '--fill-span': 4, '--lead': 0 });
    const attrs = attrsOf(7, { columns: 4, lastRow: 'fill' });
    expect(attrs.map((a) => 'data-row-fill' in a)).toEqual([false, false, false, false, true, true, true]);
  });

  it('names the outer corners of the grid each item sits on', () => {
    const corners = (count: number, t: Parameters<typeof tiling>[1]) =>
      attrsOf(count, t).map((a) => a['data-tile-corners'] ?? '');
    expect(corners(6, { columns: 3 })).toEqual(['ss', '', 'se', 'es', '', 'ee']);
    expect(corners(5, { columns: 3, lastRow: 'fill' })).toEqual(['ss', '', 'se', 'es', 'ee']);
    // A short row at the start leaves the bottom-right corner empty; a centered one leaves both bottom corners empty.
    expect(corners(5, { columns: 3 })).toEqual(['ss', '', 'se', 'es', '']);
    expect(corners(4, { columns: 3, lastRow: 'center' })).toEqual(['ss', '', 'se', '']);
    expect(corners(3, { columns: 3 })).toEqual(['ss es', '', 'se ee']);
  });
});
