import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { boundsOfPath, multiply, pathContainsPoint, pathSignedArea, rotate, translate, type Path } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { strokeToPath } from './strokeToPath';
import { strokeEdgeNear } from './strokeEdge';
import { eighth, pathOf, polyline, polylineDistance, runs, tally, timeoutFor, type Pt } from './pbt.fixture';

const RUNS = runs(100);
const PAINT = { color: '#000' };
const area = (p: Path): number => Math.abs(pathSignedArea(p));
const width = fc.integer({ min: 4, max: 160 }).map((n) => n / 8);
const closed = fc.boolean();
const shape = closed.chain((c) => polyline({ closed: c, maxLength: 5, limit: 100 }).map((pts) => ({ pts, closed: c })));
const sharp = fc.record({
  width,
  cap: fc.constantFrom('butt', 'square') as fc.Arbitrary<'butt' | 'square'>,
  join: fc.constantFrom('miter', 'bevel') as fc.Arbitrary<'miter' | 'bevel'>,
}).map((s): Stroke => ({ paint: PAINT, ...s }));

/** Points along `pts`'s segments, short of each segment's ends by a tenth. */
function along(pts: readonly Pt[], closed: boolean): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i]!, b = pts[(i + 1) % n]!;
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

describe('strokeToPath, property', () => {
  it('covers its centerline', () => {
    fc.assert(fc.property(shape, sharp, ({ pts, closed: c }, s) => {
      const out = strokeToPath(pathOf(pts, c), s);
      for (const v of out.coords) expect(Number.isFinite(v)).toBe(true);
      for (const p of along(pts, c)) expect(pathContainsPoint(out, p.x, p.y), `${p.x},${p.y}`).toBe(true);
    }), RUNS);
  }, timeoutFor(100, 40));

  it('outlines one segment as its width times its length, plus what its cap adds', () => {
    const cap = fc.constantFrom('butt', 'square', 'round') as fc.Arbitrary<'butt' | 'square' | 'round'>;
    fc.assert(fc.property(polyline({ maxLength: 2 }), width, cap, (pts, w, k) => {
      const [a, b] = pts as [Pt, Pt];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const out = strokeToPath(pathOf(pts), { paint: PAINT, width: w, cap: k }, { flattenTolerance: 1e-3 });
      const want = w * len + (k === 'square' ? w * w : k === 'round' ? (Math.PI * w * w) / 4 : 0);
      // The ribbon fans a round cap in 10° steps, whatever the flattening.
      expect(Math.abs(area(out) - want)).toBeLessThanOrEqual(1e-4 * want + (k === 'round' ? 0.005 * w * w : 0));
    }), RUNS);
  }, timeoutFor(100, 10));

  it('scales its area by k² when the path and the width scale by k', () => {
    const k = fc.integer({ min: 2, max: 8 }).map((n) => n / 4);
    fc.assert(fc.property(shape, sharp, k, ({ pts, closed: c }, s, f) => {
      const a = area(strokeToPath(pathOf(pts, c), s));
      const b = area(strokeToPath(pathOf(pts.map((p) => ({ x: p.x * f, y: p.y * f })), c), { ...s, width: (s.width as number) * f }));
      expect(Math.abs(b - a * f * f)).toBeLessThanOrEqual(1e-4 * a * f * f + 1e-3);
    }), RUNS);
  }, timeoutFor(100, 60));

  it('draws the same outline in a frame that only turns and moves it', () => {
    const angle = fc.double({ min: -Math.PI, max: Math.PI, noNaN: true });
    fc.assert(fc.property(shape, sharp, angle, eighth(), eighth(), ({ pts, closed: c }, s, t, tx, ty) => {
      const path = pathOf(pts, c);
      const plain = strokeToPath(path, s);
      const framed = strokeToPath(path, s, { frame: multiply(translate(tx, ty), rotate(t)) });
      const a = area(plain);
      expect(Math.abs(area(framed) - a)).toBeLessThanOrEqual(1e-4 * a + 1e-3);
      const pb = boundsOfPath(plain), fb = boundsOfPath(framed);
      const slack = 1e-3 * (1 + pb.width + pb.height);
      expect(Math.abs(fb.x - pb.x)).toBeLessThanOrEqual(slack);
      expect(Math.abs(fb.y - pb.y)).toBeLessThanOrEqual(slack);
      expect(Math.abs(fb.width - pb.width)).toBeLessThanOrEqual(slack);
    }), RUNS);
  }, timeoutFor(100, 60));
});

describe('strokeEdgeNear, property', () => {
  it('agrees with the outline: a point it finds inside is inked, and one outside every edge is not', () => {
    // Round caps and joins make the ink exactly the points within half the width of the path.
    const inside = tally(), outside = tally();
    const probe = fc.record({ x: fc.double({ min: -120, max: 120, noNaN: true }), y: fc.double({ min: -120, max: 120, noNaN: true }) });
    fc.assert(fc.property(shape, width, fc.array(probe, { minLength: 8, maxLength: 8 }), ({ pts, closed: c }, w, probes) => {
      const path = pathOf(pts, c);
      const s: Stroke = { paint: PAINT, width: w, cap: 'round', join: 'round' };
      const out = strokeToPath(path, s, { flattenTolerance: 1e-3 });
      // Each probe is also pulled toward the path, so some land in the ink.
      const near = probes.map((p, i) => (i % 2 ? p : { x: pts[0]!.x + (p.x / 120) * w, y: pts[0]!.y + (p.y / 120) * w }));
      for (const p of near) {
        const d = polylineDistance(p, pts, c);
        if (Math.abs(d - w / 2) < 0.02 * w + 0.01) continue;
        const hit = strokeEdgeNear(path, s, p.x, p.y)!;
        expect(hit).not.toBeNull();
        if (hit.gap < 0) expect(d).toBeLessThan(w / 2);
        if (d > w / 2) expect(hit.gap).toBeGreaterThan(0);
        expect(pathContainsPoint(out, p.x, p.y), `${p.x},${p.y} at ${d}`).toBe(d < w / 2);
        (d < w / 2 ? inside : outside).hit();
      }
    }), RUNS);
    inside.atLeast(0.5, RUNS.numRuns);
    outside.atLeast(0.5, RUNS.numRuns);
  }, timeoutFor(100, 60));

  it('measures a centered stroke of one width as the distance to its path less half the width', () => {
    fc.assert(fc.property(shape, width, eighth(150), eighth(150), ({ pts, closed: c }, w, x, y) => {
      const hit = strokeEdgeNear(pathOf(pts, c), { paint: PAINT, width: w }, x, y)!;
      const d = polylineDistance({ x, y }, pts, c);
      // The nearest edge, not the nearest segment: a point between two can sit nearer the far one's edge.
      expect(Math.abs(hit.gap)).toBeLessThanOrEqual(Math.abs(d - w / 2) + 1e-9 * (1 + d));
      expect(hit.left).toBeCloseTo(w / 2, 9);
      expect(hit.right).toBeCloseTo(w / 2, 9);
      expect(Math.hypot(hit.nx, hit.ny)).toBeCloseTo(1, 9);
    }), RUNS);
  }, timeoutFor(100, 5));
});
