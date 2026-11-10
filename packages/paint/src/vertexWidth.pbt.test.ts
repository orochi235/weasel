import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { scaleVertexWidth, vertexHalfWidths, vertexWidthFromSides, widestHalfWidth, type VertexWidth } from './vertexWidth';
import { runs } from './pbt.fixture';

const RUNS = runs(300);
const side = fc.oneof(fc.double({ min: 0, max: 100, noNaN: true }), fc.constant(0));
const bad = fc.constantFrom(-1, Number.NaN, Infinity, -Infinity);
const width = fc.double({ min: 0, max: 100, noNaN: true });
const entry: fc.Arbitrary<VertexWidth> = fc.oneof(side, fc.record({ left: side, right: side }));
const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

describe('vertex widths, property', () => {
  it('reads back the sides vertexWidthFromSides writes', () => {
    fc.assert(fc.property(side, side, width, (l, r, w) => {
      const e = vertexWidthFromSides(l, r);
      const { left, right } = vertexHalfWidths(e, w);
      expect(close(left, l) && close(right, r), `${l},${r} → ${JSON.stringify(e)}`).toBe(true);
      if (typeof e === 'object') expect(e.left).not.toBe(e.right);
    }), RUNS);
  });

  it('falls back to half the stroke\'s width for each unusable side, and only for those', () => {
    fc.assert(fc.property(fc.oneof(side, bad), fc.oneof(side, bad), width, (l, r, w) => {
      const got = vertexHalfWidths({ left: l, right: r }, w);
      const ok = (v: number) => Number.isFinite(v) && v >= 0;
      expect(got.left).toBe(ok(l) ? l : w / 2);
      expect(got.right).toBe(ok(r) ? r : w / 2);
      expect(vertexHalfWidths(Number.isFinite(l) && l >= 0 ? l : Number.NaN, w).left).toBe(ok(l) ? l / 2 : w / 2);
    }), RUNS);
  });

  it('scales every side by k, and undoes with 1/k', () => {
    fc.assert(fc.property(entry, fc.double({ min: 1e-3, max: 1e3, noNaN: true }), width, (e, k, w) => {
      const h = vertexHalfWidths(e, w);
      const s = vertexHalfWidths(scaleVertexWidth(e, k), w * k);
      expect(close(s.left, h.left * k) && close(s.right, h.right * k)).toBe(true);
      const back = vertexHalfWidths(scaleVertexWidth(scaleVertexWidth(e, k), 1 / k), w);
      expect(close(back.left, h.left) && close(back.right, h.right)).toBe(true);
    }), RUNS);
  });

  it('reports the farthest edge widestHalfWidth bounds a stroke by', () => {
    fc.assert(fc.property(width, fc.option(fc.array(fc.oneof(entry, bad), { maxLength: 6 }), { nil: undefined }), (w, es) => {
      const all = (es ?? []).map((e) => vertexHalfWidths(e, w));
      expect(widestHalfWidth(w, es)).toBe(Math.max(w / 2, ...all.flatMap((h) => [h.left, h.right])));
    }), RUNS);
  });
});
