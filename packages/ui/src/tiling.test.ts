import { describe, expect, it } from 'vitest';
import { tiling } from './tiling';

const attrsOf = (count: number, t: Parameters<typeof tiling>[1]) => {
  const tiles = tiling(count, t);
  return Array.from({ length: count }, (_, i) => tiles.item(i));
};

describe('tiling', () => {
  it('carries the grid onto the container as custom properties', () => {
    expect(tiling(7, { columns: 4, lastRow: 'fill' }).style)
      .toEqual({ '--tracks': 12, '--span': 3, '--fill-span': 4, '--lead': 0 });
  });

  it('marks the item that starts an offset last row, the stretched ones, and the corners', () => {
    expect(attrsOf(13, { columns: 10, lastRow: 'center' })[10]).toHaveProperty('data-row-lead');
    expect(attrsOf(13, { columns: 10 }).some((a) => 'data-row-lead' in a)).toBe(false);
    expect(attrsOf(5, { columns: 3, lastRow: 'fill' }).map((a) => 'data-row-fill' in a)).toEqual([false, false, false, true, true]);
    expect(attrsOf(5, { columns: 3, lastRow: 'fill' }).map((a) => a['data-tile-corners'] ?? '')).toEqual(['ss', '', 'se', 'es', 'ee']);
  });
});
