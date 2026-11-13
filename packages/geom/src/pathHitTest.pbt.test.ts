import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pointInPath, strokeHitTest } from './pathHitTest';
import { transformPath } from './paths/transformPath';
import { PathBuilder } from './paths/builder';
import { transformPoint, multiply, rotate, scale, translate, type Affine } from './affine';
import type { Path, PathFillRule } from './path';
import { affine, angle, coord, runs } from './pbt.fixture';

const RUNS = runs(200);
const FINE = { flattenTolerance: 0.01 };

/** A polygon of straight edges, self-crossing as often as not. */
const polyline = fc.record({
  pts: fc.array(fc.tuple(coord(100), coord(100)), { minLength: 3, maxLength: 8 }),
  rule: fc.constantFrom<PathFillRule>('nonzero', 'evenodd'),
}).map(({ pts, rule }) => {
  const b = new PathBuilder().setFillRule(rule).moveTo(...pts[0]);
  for (const p of pts.slice(1)) b.lineTo(...p);
  return b.close().build() as Path;
});

/** An ellipse of four cubics, a second one inside it as a hole or not. */
const ellipses = fc.record({
  cx: coord(50), cy: coord(50), rx: fc.double({ min: 5, max: 100, noNaN: true }), ry: fc.double({ min: 5, max: 100, noNaN: true }),
  inner: fc.double({ min: 0.2, max: 0.8, noNaN: true }), rule: fc.constantFrom<PathFillRule>('nonzero', 'evenodd'),
}).map(({ cx, cy, rx, ry, inner, rule }) => {
  const b = new PathBuilder().setFillRule(rule);
  const k = 0.5522847498;
  for (const s of [1, inner]) {
    const x = rx * s, y = ry * s;
    b.moveTo(cx + x, cy)
      .curveTo(cx + x, cy + k * y, cx + k * x, cy + y, cx, cy + y)
      .curveTo(cx - k * x, cy + y, cx - x, cy + k * y, cx - x, cy)
      .curveTo(cx - x, cy - k * y, cx - k * x, cy - y, cx, cy - y)
      .curveTo(cx + k * x, cy - y, cx + x, cy - k * y, cx + x, cy)
      .close();
  }
  return b.build() as Path;
});

const rectPath = fc.record({ x: coord(100), y: coord(100), width: fc.double({ min: 0, max: 200, noNaN: true }), height: fc.double({ min: 0, max: 200, noNaN: true }) })
  .map((r) => ({ kind: 'rect' as const, ...r }));

/** Rotation, scale both ways, and mirror only: rects stay rects. */
const axisAligned: fc.Arbitrary<Affine> = fc.tuple(
  fc.double({ min: 0.1, max: 10, noNaN: true }), fc.double({ min: 0.1, max: 10, noNaN: true }),
  fc.boolean(), fc.boolean(), coord(), coord(),
).map(([sx, sy, fx, fy, tx, ty]) => multiply(translate(tx, ty), scale(fx ? -sx : sx, fy ? -sy : sy)));

/** Smallest stretch of `m`'s linear part: how much it can shrink a distance. */
function shrink(m: Affine): number {
  const [a, b, c, d] = m;
  const p = a * a + b * b + c * c + d * d, q = Math.abs(a * d - b * c);
  return Math.sqrt(Math.max(0, p / 2 - Math.sqrt(Math.max(0, (p * p) / 4 - q * q))));
}

describe('hit-testing under a transform, property', () => {
  it('hit-testing a transformed shape is hit-testing the point under the inverse', () => {
    const shape = fc.oneof(polyline, ellipses);
    fc.assert(fc.property(shape, affine, coord(150), coord(150), (path, m, x, y) => {
      // Flattening and float32 coords move the outline a little; only points clear of it have to agree.
      fc.pre(!strokeHitTest(path, x, y, 0.05, FINE));
      const [u, v] = transformPoint(m, x, y);
      const moved = transformPath(path, m);
      fc.pre(!strokeHitTest(moved, u, v, 0.05 * shrink(m), FINE));
      expect(pointInPath(moved, u, v, FINE)).toBe(pointInPath(path, x, y, FINE));
    }), RUNS);
  });

  it('a rect stays a rect under an axis-aligned map and hits as one', () => {
    fc.assert(fc.property(rectPath, axisAligned, coord(150), coord(150), (path, m, x, y) => {
      const moved = transformPath(path, m);
      expect(moved.kind).toBe('rect');
      fc.pre(!strokeHitTest(path, x, y, 1e-6 * 1000));
      const [u, v] = transformPoint(m, x, y);
      expect(pointInPath(moved, u, v)).toBe(pointInPath(path, x, y));
    }), RUNS);
  });

  it('a stroke band scales with a similarity', () => {
    const similarity = fc.tuple(angle, fc.double({ min: 0.1, max: 10, noNaN: true }), fc.boolean(), coord(), coord())
      .map(([t, k, flip, tx, ty]) => ({ k, m: multiply(translate(tx, ty), multiply(rotate(t), scale(flip ? -k : k, k))) }));
    fc.assert(fc.property(polyline, similarity, coord(150), coord(150), fc.double({ min: 0.5, max: 30, noNaN: true }),
      (path, { k, m }, x, y, r) => {
        const hit = strokeHitTest(path, x, y, r);
        // Off the band's edge, where rounding could put the point either side.
        fc.pre(strokeHitTest(path, x, y, r * 0.999) === hit && strokeHitTest(path, x, y, r * 1.001) === hit);
        const [u, v] = transformPoint(m, x, y);
        expect(strokeHitTest(transformPath(path, m), u, v, r * k)).toBe(hit);
      }), RUNS);
  });

  it('slop in pixels is the screen distance the transform carries the outline to', () => {
    fc.assert(fc.property(polyline, affine, coord(150), coord(150), fc.double({ min: 0.5, max: 30, noNaN: true }),
      (path, m, x, y, px) => {
        const lin: Affine = [m[0], m[1], m[2], m[3], 0, 0];
        const screen = transformPath(path, lin);
        const [u, v] = transformPoint(lin, x, y);
        const onScreen = strokeHitTest(screen, u, v, px);
        fc.pre(strokeHitTest(screen, u, v, px * 0.999) === onScreen && strokeHitTest(screen, u, v, px * 1.001) === onScreen);
        expect(strokeHitTest(path, x, y, 0, { slop: { px, transform: m } })).toBe(onScreen);
      }), RUNS);
  });
});
