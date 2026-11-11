import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { cubicBounds, cubicEvalAt, quadraticEvalAt, splitCubicAt, type CubicCoords } from './curve';
import { nearestOnCubic } from './nearest';
import { flattenCubic, flattenCubicWithArcLen, flattenQuadratic, flattenQuadraticWithArcLen } from './flatten';
import { segmentLength, segmentTAtLength } from './paths/segmentLength';
import { intersectSegments } from './intersect/segmentIntersections';
import { pointSegmentDist } from './points2';
import { coord, runs, timeoutFor } from './pbt.fixture';

const RUNS = runs(200);
const TIMEOUT = timeoutFor(200, 30);

const cubic: fc.Arbitrary<CubicCoords> = fc.tuple(coord(500), coord(500), coord(500), coord(500), coord(500), coord(500), coord(500), coord(500));
const unitT = fc.double({ min: 0, max: 1, noNaN: true });

const at = (c: CubicCoords, t: number): [number, number] => cubicEvalAt(...c, t);
/** The largest coordinate magnitude: what rounding in the curve's arithmetic scales with. */
const size = (c: readonly number[]): number => Math.max(1, ...c.map(Math.abs));
const samples = (c: CubicCoords, n: number): [number, number][] => Array.from({ length: n + 1 }, (_, k) => at(c, k / n));

describe('splitCubicAt, property', () => {
  it('halves that trace the curve, each over its own share of the parameter', () => {
    fc.assert(fc.property(cubic, unitT, unitT, (c, t, u) => {
      const [left, right] = splitCubicAt(...c, t);
      const eps = size(c) * 1e-12;
      const [lx, ly] = at(left, u), [ox, oy] = at(c, t * u);
      expect(Math.hypot(lx - ox, ly - oy)).toBeLessThan(eps);
      const [rx, ry] = at(right, u), [px, py] = at(c, t + (1 - t) * u);
      expect(Math.hypot(rx - px, ry - py)).toBeLessThan(eps);
      expect(left[6]).toBe(right[0]);
      expect(left[7]).toBe(right[1]);
    }), RUNS);
  }, TIMEOUT);
});

describe('cubicBounds, property', () => {
  it('holds every point of the curve, and each side touches it', () => {
    fc.assert(fc.property(cubic, (c) => {
      const [x0, y0, x1, y1] = cubicBounds(...c);
      const n = 500;
      const eps = size(c) * 1e-12;
      let lx = Infinity, hx = -Infinity, ly = Infinity, hy = -Infinity;
      for (const [x, y] of samples(c, n)) {
        expect(x >= x0 - eps && x <= x1 + eps && y >= y0 - eps && y <= y1 + eps).toBe(true);
        lx = Math.min(lx, x); hx = Math.max(hx, x); ly = Math.min(ly, y); hy = Math.max(hy, y);
      }
      // A sample lies within one step's travel of each extreme: three times the control polygon bounds the speed.
      const reach = (Math.hypot(c[2] - c[0], c[3] - c[1]) + Math.hypot(c[4] - c[2], c[5] - c[3]) + Math.hypot(c[6] - c[4], c[7] - c[5])) * 3 / n + eps;
      expect(Math.max(lx - x0, x1 - hx, ly - y0, y1 - hy)).toBeLessThan(reach);
    }), RUNS);
  }, TIMEOUT);
});

describe('nearestOnCubic, property', () => {
  it('finds a point on the curve no farther than any sampled one', () => {
    fc.assert(fc.property(cubic, coord(600), coord(600), (c, px, py) => {
      const hit = nearestOnCubic(px, py, ...c);
      expect(hit.t).toBeGreaterThanOrEqual(0);
      expect(hit.t).toBeLessThanOrEqual(1);
      const [x, y] = at(c, hit.t);
      expect(Math.hypot(x - hit.x, y - hit.y)).toBeLessThan(size(c) * 1e-12);
      expect(Math.abs(hit.dist - Math.hypot(px - hit.x, py - hit.y))).toBeLessThan(size(c) * 1e-12);
      const brute = Math.min(...samples(c, 3000).map(([sx, sy]) => Math.hypot(px - sx, py - sy)));
      expect(hit.dist).toBeLessThanOrEqual(brute + size(c) * 1e-9);
    }), RUNS);
  }, TIMEOUT);
});

describe('segmentLength, property', () => {
  it('agrees with a fine polyline, and adds up over a split', () => {
    fc.assert(fc.property(cubic, unitT, (c, s) => {
      const total = segmentLength(c, 2);
      const pts = samples(c, 20000);
      let chords = 0;
      for (let k = 1; k < pts.length; k++) chords += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      // Chords run short of the arc, by less than its length times their turn squared, which 20,000 keep tiny.
      expect(total).toBeGreaterThanOrEqual(chords - 1e-8 * total - size(c) * 1e-12);
      expect(total - chords).toBeLessThan(1e-6 * total + size(c) * 1e-9);
      const parts = segmentLength(c, 2, 0, s) + segmentLength(c, 2, s, 1);
      expect(Math.abs(parts - total)).toBeLessThan(1e-9 * total + size(c) * 1e-12);
    }), RUNS);
  }, TIMEOUT);

  it('segmentTAtLength finds where the curve has run a length', () => {
    fc.assert(fc.property(cubic, unitT, (c, f) => {
      const total = segmentLength(c, 2);
      fc.pre(total > 1e-6);
      const t = segmentTAtLength(c, 2, f * total, total);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
      expect(Math.abs(segmentLength(c, 2, 0, t) - f * total)).toBeLessThan(1e-8 * total);
    }), RUNS);
  }, TIMEOUT);
});

describe('flattenCubic, property', () => {
  it('stays within its tolerance of every point of the curve, and ends where the curve does', () => {
    const tolerance = fc.double({ min: 0.01, max: 5, noNaN: true });
    fc.assert(fc.property(cubic, tolerance, (c, tol) => {
      const out: number[] = [];
      flattenCubic(...c, tol, out);
      expect(out.slice(-2)).toEqual([c[6], c[7]]);
      const line = [c[0], c[1], ...out];
      const eps = size(c) * 1e-12;
      // Each vertex is a point of the curve, at a dyadic parameter.
      for (let k = 2; k < line.length; k += 2) {
        const near = nearestOnCubic(line[k]!, line[k + 1]!, ...c);
        expect(near.dist).toBeLessThan(size(c) * 1e-9);
      }
      for (const [x, y] of samples(c, 1000)) {
        let best = Infinity;
        for (let k = 0; k + 3 < line.length; k += 2) best = Math.min(best, pointSegmentDist(x, y, line[k]!, line[k + 1]!, line[k + 2]!, line[k + 3]!));
        expect(best).toBeLessThanOrEqual(tol + eps);
      }
    }), RUNS);
  }, TIMEOUT);
});

describe('flattenQuadratic, property', () => {
  it('stays within its tolerance of every point of the curve', () => {
    const quad = fc.tuple(coord(500), coord(500), coord(500), coord(500), coord(500), coord(500));
    fc.assert(fc.property(quad, fc.double({ min: 0.01, max: 5, noNaN: true }), (q, tol) => {
      const out: number[] = [];
      flattenQuadratic(...q, tol, out);
      expect(out.slice(-2)).toEqual([q[4], q[5]]);
      const line = [q[0], q[1], ...out];
      for (let k = 0; k <= 1000; k++) {
        const [x, y] = quadraticEvalAt(...q, k / 1000);
        let best = Infinity;
        for (let i = 0; i + 3 < line.length; i += 2) best = Math.min(best, pointSegmentDist(x, y, line[i]!, line[i + 1]!, line[i + 2]!, line[i + 3]!));
        expect(best).toBeLessThanOrEqual(tol + size(q) * 1e-12);
      }
    }), RUNS);
  }, TIMEOUT);
});

describe('flattening with arc lengths, property', () => {
  it('draws the same points as plain flattening, counts each chord once, and only refines for an offset', () => {
    fc.assert(fc.property(cubic, fc.double({ min: 0.01, max: 5, noNaN: true }), fc.double({ min: 0, max: 50, noNaN: true }), (c, tol, offset) => {
      const plain: number[] = [];
      flattenCubic(...c, tol, plain);
      const out: number[] = [], arcs: number[] = [];
      const total = flattenCubicWithArcLen(...c, tol, out, arcs);
      expect(out).toEqual(plain);
      expect(arcs.length).toBe(out.length / 2);
      let x = c[0], y = c[1], sum = 0;
      for (let k = 0; k < arcs.length; k++) {
        sum += Math.hypot(out[2 * k]! - x, out[2 * k + 1]! - y);
        x = out[2 * k]!; y = out[2 * k + 1]!;
        expect(Math.abs(arcs[k]! - sum)).toBeLessThanOrEqual(sum * 1e-15);
      }
      expect(total).toBe(arcs[arcs.length - 1]);
      expect(total).toBeLessThanOrEqual(segmentLength(c, 2) * (1 + 1e-9) + size(c) * 1e-12);
      const wide: number[] = [], wideArcs: number[] = [];
      flattenCubicWithArcLen(...c, tol, wide, wideArcs, offset);
      // Every vertex of the plain flattening is kept: the offset only splits pieces further.
      const kept = new Set<string>();
      for (let k = 0; k < wide.length; k += 2) kept.add(`${wide[k]},${wide[k + 1]}`);
      for (let k = 0; k < plain.length; k += 2) expect(kept.has(`${plain[k]},${plain[k + 1]}`)).toBe(true);
      for (let k = 1; k < wideArcs.length; k++) expect(wideArcs[k]!).toBeGreaterThanOrEqual(wideArcs[k - 1]!);
    }), RUNS);
  }, TIMEOUT);

  it('a quadratic draws what plain flattening does, with arc lengths counted from its start', () => {
    const quad = fc.tuple(coord(500), coord(500), coord(500), coord(500), coord(500), coord(500));
    fc.assert(fc.property(quad, fc.double({ min: 0.01, max: 5, noNaN: true }), (q, tol) => {
      const plain: number[] = [];
      flattenQuadratic(...q, tol, plain);
      const out: number[] = [], arcs: number[] = [];
      const total = flattenQuadraticWithArcLen(...q, tol, out, arcs);
      expect(out).toEqual(plain);
      let sum = 0;
      for (let k = 0; k < arcs.length; k++) {
        sum += Math.hypot(out[2 * k]! - (k ? out[2 * k - 2]! : q[0]), out[2 * k + 1]! - (k ? out[2 * k - 1]! : q[1]));
        expect(Math.abs(arcs[k]! - sum)).toBeLessThanOrEqual(sum * 1e-15);
      }
      expect(total).toBe(arcs[arcs.length - 1]);
    }), RUNS);
  }, TIMEOUT);
});

type P = { x: number; y: number };
const pts = (c: readonly number[]): P[] => Array.from({ length: c.length / 2 }, (_, i) => ({ x: c[2 * i]!, y: c[2 * i + 1]! }));
const evalPts = (s: P[], t: number): P => {
  let row = s;
  while (row.length > 1) row = row.slice(1).map((q, i) => ({ x: row[i]!.x + (q.x - row[i]!.x) * t, y: row[i]!.y + (q.y - row[i]!.y) * t }));
  return row[0]!;
};

/** Where two polylines cross squarely enough, away from either end, that the curves they sample must cross there too. */
function clearCrossings(a: P[], b: P[], n: number): P[] {
  const sa = Array.from({ length: n + 1 }, (_, k) => evalPts(a, k / n));
  const sb = Array.from({ length: n + 1 }, (_, k) => evalPts(b, k / n));
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = sa[i]!, p1 = sa[i + 1]!;
    for (let j = 0; j < n; j++) {
      const q0 = sb[j]!, q1 = sb[j + 1]!;
      const rx = p1.x - p0.x, ry = p1.y - p0.y, sx = q1.x - q0.x, sy = q1.y - q0.y;
      const den = rx * sy - ry * sx;
      const lens = Math.hypot(rx, ry) * Math.hypot(sx, sy);
      if (!(Math.abs(den) > 0.3 * lens)) continue;
      const u = ((q0.x - p0.x) * sy - (q0.y - p0.y) * sx) / den;
      const v = ((q0.x - p0.x) * ry - (q0.y - p0.y) * rx) / den;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const ta = (i + u) / n, tb = (j + v) / n;
      if (ta < 0.02 || ta > 0.98 || tb < 0.02 || tb > 0.98) continue;
      out.push({ x: p0.x + rx * u, y: p0.y + ry * u });
    }
  }
  return out;
}

describe('intersectSegments, a crossing at the very end of a curve (shrunk counterexample)', () => {
  it('reports parameters inside 0..1', () => {
    // A cubic of subnormal length: the chord test's slack put ta at -1e-6, and refinement stopped before clamping it.
    const a = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: -1.7285717905e-314 }];
    const b = [{ x: 1e-323, y: 0 }, { x: 0, y: -85.50024445890497 }, { x: 99.99999999781028, y: 0 }, { x: 0, y: 0 }];
    const hits = intersectSegments(a, b);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.ta).toBeGreaterThanOrEqual(0);
      expect(h.tb).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('intersectSegments, property', () => {
  // Mostly plain coordinates, so curves cross often; sometimes the edge cases `coord` favors.
  const value = fc.oneof({ weight: 4, arbitrary: fc.integer({ min: -1e6, max: 1e6 }).map((n) => n / 1e4) }, { weight: 1, arbitrary: coord(100) });
  const seg = fc.integer({ min: 2, max: 4 }).chain((n) => fc.array(value, { minLength: 2 * n, maxLength: 2 * n })).map((c) => pts(c));

  it('reports only points on both segments, and every square crossing a sampling finds', () => {
    const tally = { crossings: 0 };
    fc.assert(fc.property(seg, seg, (a, b) => {
      const hits = intersectSegments(a, b);
      for (const h of hits) {
        expect(h.ta).toBeGreaterThanOrEqual(0);
        expect(h.ta).toBeLessThanOrEqual(1);
        expect(h.tb).toBeGreaterThanOrEqual(0);
        expect(h.tb).toBeLessThanOrEqual(1);
        const pa = evalPts(a, h.ta), pb = evalPts(b, h.tb);
        expect(Math.hypot(pa.x - h.x, pa.y - h.y)).toBeLessThan(1e-6);
        expect(Math.hypot(pb.x - h.x, pb.y - h.y)).toBeLessThan(1e-4);
      }
      for (let k = 1; k < hits.length; k++) expect(hits[k]!.ta).toBeGreaterThanOrEqual(hits[k - 1]!.ta);
      if (hits.length >= 16) return;
      for (const c of clearCrossings(a, b, 400)) {
        tally.crossings++;
        const near = Math.min(...hits.map((h) => Math.hypot(h.x - c.x, h.y - c.y)));
        expect({ c, near: near < 0.05 }).toEqual({ c, near: true });
      }
    }), RUNS);
    expect(tally.crossings).toBeGreaterThan(RUNS.numRuns / 4);
  }, TIMEOUT);
});
