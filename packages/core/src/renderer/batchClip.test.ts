import { describe, it, expect } from 'vitest';
import { axisAlignedClipRect, clipConvexPolygon, intersectClipRects } from './batchClip';

const STRIDE = 3; // x, y, and one attribute affine in both
const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/** A square's corners carrying `a = x + 2y`, which any exact cut preserves. */
function square(x0: number, y0: number, x1: number, y1: number): Float32Array {
  const out: number[] = [];
  for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) out.push(x, y, x + 2 * y);
  return new Float32Array(out);
}

function cut(poly: Float32Array, n: number, rect: { x0: number; y0: number; x1: number; y1: number }) {
  const dst = new Float32Array((n + 4) * STRIDE);
  const tmp = new Float32Array((n + 4) * STRIDE);
  const m = clipConvexPolygon(poly, n, STRIDE, rect, dst, tmp);
  const corners: number[][] = [];
  for (let i = 0; i < m; i++) corners.push(Array.from(dst.subarray(i * STRIDE, (i + 1) * STRIDE)));
  return corners;
}

describe('clipConvexPolygon', () => {
  it('leaves a polygon inside the rect as it was', () => {
    expect(cut(square(1, 1, 2, 2), 4, { x0: 0, y0: 0, x1: 10, y1: 10 }))
      .toEqual([[1, 1, 3], [2, 1, 4], [2, 2, 6], [1, 2, 5]]);
  });

  it('cuts to the overlap, interpolating every attribute along the cut edge', () => {
    const corners = cut(square(0, 0, 10, 10), 4, { x0: 2.5, y0: -1, x1: 20, y1: 4 });
    for (const [x, y, a] of corners) {
      expect(x).toBeGreaterThanOrEqual(2.5);
      expect(y).toBeLessThanOrEqual(4);
      expect(a).toBeCloseTo(x + 2 * y, 5);
    }
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([2.5, 10, 0, 4]);
  });

  it('puts a cut corner exactly on the rect edge', () => {
    // A slanted edge whose interpolated x would round off the line.
    const tri = new Float32Array([0, 0, 0, 3, 1, 0, 0.1, 7, 0]);
    for (const [x] of cut(tri, 3, { x0: 1 / 3, y0: -10, x1: 10, y1: 10 })) {
      expect(x).toBeGreaterThanOrEqual(1 / 3);
    }
  });

  it('leaves fewer than three corners for a polygon outside the rect', () => {
    expect(cut(square(0, 0, 1, 1), 4, { x0: 5, y0: 5, x1: 6, y1: 6 }).length).toBeLessThan(3);
  });

  it('turns a diamond into an octagon when the rect cuts every corner off', () => {
    const diamond = new Float32Array([0, -2, 0, 2, 0, 0, 0, 2, 0, -2, 0, 0]);
    expect(cut(diamond, 4, { x0: -1, y0: -1, x1: 1, y1: 1 })).toHaveLength(8);
  });
});

describe('axisAlignedClipRect', () => {
  const rect = { kind: 'rect' as const, x: 1, y: 2, width: 3, height: 4 };

  it('maps a rect through a scale and translate', () => {
    const m = new Float32Array([2, 0, 0, 0, -1, 0, 10, 20, 1]);
    expect(axisAlignedClipRect(rect, m)).toEqual({ x0: 12, y0: 14, x1: 18, y1: 18 });
  });

  it('accepts a quarter turn, which keeps the axes', () => {
    const quarter = new Float32Array([0, 1, 0, -1, 0, 0, 0, 0, 1]);
    expect(axisAlignedClipRect(rect, quarter)).toEqual({ x0: -6, y0: 1, x1: -2, y1: 4 });
  });

  it('refuses a turn that takes the rect off the axes', () => {
    const c = Math.SQRT1_2;
    expect(axisAlignedClipRect(rect, new Float32Array([c, c, 0, -c, c, 0, 0, 0, 1]))).toBeNull();
  });

  it('refuses anything but a rect path', () => {
    const poly = { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
    expect(axisAlignedClipRect(poly as never, identity)).toBeNull();
  });
});

describe('intersectClipRects', () => {
  it('keeps the overlap, and an empty rect when there is none', () => {
    expect(intersectClipRects({ x0: 0, y0: 0, x1: 5, y1: 5 }, { x0: 3, y0: -1, x1: 9, y1: 4 }))
      .toEqual({ x0: 3, y0: 0, x1: 5, y1: 4 });
    const none = intersectClipRects({ x0: 0, y0: 0, x1: 1, y1: 1 }, { x0: 2, y0: 2, x1: 3, y1: 3 });
    expect(none.x1 < none.x0).toBe(true);
  });
});
