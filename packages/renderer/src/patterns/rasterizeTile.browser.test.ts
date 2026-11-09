/** A tile size a canvas cannot hold rasterizes nothing, rather than throwing out of the painter that asked. */
import { describe, expect, it } from 'vitest';
import { rasterizeTile } from './rasterizeTile';
import { resolvePatternSpec } from './resolveSpec';

describe('rasterizeTile on a size with no pixels', () => {
  it('gives no bitmap for a zero, fractional, negative, NaN or infinite size', () => {
    for (const size of [0, 0.5, -3, NaN, Infinity]) {
      expect(rasterizeTile({ size, draw: () => {} }), String(size)).toBeNull();
    }
  });

  it('resolves no texture for a tile spec of such a size', () => {
    for (const size of [0, -3, NaN]) {
      expect(resolvePatternSpec({ kind: 'hatch', color: '#000', size }), String(size)).toBeNull();
    }
  });

  it('still rasterizes a tile of one pixel', () => {
    const bitmap = rasterizeTile({ size: 1, draw: () => {} });
    expect(bitmap?.width).toBe(1);
    bitmap?.close();
  });
});
