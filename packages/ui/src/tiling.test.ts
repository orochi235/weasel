import { describe, expect, it } from 'vitest';
import { tiling } from './tiling';

describe('tiling', () => {
  it('puts the spare columns of a short last row before it, in half-columns', () => {
    expect(tiling(13, { columns: 10, lastRow: 'start' }).lead).toBe(0);
    expect(tiling(13, { columns: 10, lastRow: 'center' }).lead).toBe(7);
    expect(tiling(13, { columns: 10, lastRow: 'end' }).lead).toBe(14);
    expect(tiling(20, { columns: 10, lastRow: 'end' }).lead).toBe(0);
  });

  it('names the item that starts an offset last row, and none otherwise', () => {
    expect(tiling(13, { columns: 10, lastRow: 'center' }).rowLead).toBe(10);
    expect(tiling(13, { columns: 10 }).rowLead).toBe(-1);
    expect(tiling(20, { columns: 10, lastRow: 'end' }).rowLead).toBe(-1);
  });

  it('lays the grid in half-column tracks', () => {
    expect(tiling(7, { columns: 4, lastRow: 'center' }).style).toEqual({ '--tracks': 8, '--lead': 1 });
  });
});
