import { describe, it, expect, vi, afterEach } from 'vitest';
import { ShelfPacker } from './shelfPack';

afterEach(() => vi.restoreAllMocks());

describe('ShelfPacker', () => {
  it('packs left-to-right on a shelf', () => {
    const p = new ShelfPacker(64, 4);
    expect(p.alloc(10, 10)).toEqual({ page: 0, x: 0, y: 0 });
    expect(p.alloc(10, 10)).toEqual({ page: 0, x: 10, y: 0 });
    expect(p.pageCount).toBe(1);
  });

  it('opens a new shelf when a row fills', () => {
    const p = new ShelfPacker(32, 4);
    expect(p.alloc(20, 10)).toEqual({ page: 0, x: 0, y: 0 });
    expect(p.alloc(20, 10)).toEqual({ page: 0, x: 0, y: 10 });
  });

  it('puts a taller glyph on its own shelf but backfills shorter ones', () => {
    const p = new ShelfPacker(64, 4);
    expect(p.alloc(10, 10)).toEqual({ page: 0, x: 0, y: 0 });
    expect(p.alloc(10, 20)).toEqual({ page: 0, x: 0, y: 10 });
    // Fits back on the first (height-10) shelf.
    expect(p.alloc(10, 10)).toEqual({ page: 0, x: 10, y: 0 });
  });

  it('overflows to a new page when vertical space runs out', () => {
    const p = new ShelfPacker(16, 2);
    expect(p.alloc(16, 16)).toEqual({ page: 0, x: 0, y: 0 });
    expect(p.alloc(16, 16)).toEqual({ page: 1, x: 0, y: 0 });
    expect(p.pageCount).toBe(2);
  });

  it('returns null and warns exactly once at the page cap', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = new ShelfPacker(16, 1);
    expect(p.alloc(16, 16)).toEqual({ page: 0, x: 0, y: 0 });
    expect(p.alloc(16, 16)).toBeNull();
    expect(p.alloc(4, 4)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('rejects rects larger than a page without creating pages', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = new ShelfPacker(16, 4);
    expect(p.alloc(17, 4)).toBeNull();
    expect(p.pageCount).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
