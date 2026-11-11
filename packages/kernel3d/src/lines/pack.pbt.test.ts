/**
 * Lines as the line pass's vertices: a trim keeps exactly the length it names, on the line and in pen order, with a
 * head on each open run alone; packing writes six vertices a segment and three a head, every float finite, each run's
 * length measured along it; and a head never outgrows its share of the line or the shaft its head.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { closestPointOnSegment, compose, type Vec3 } from '@weasel-js/geom/3d';
import { quat, runs, tally, timeoutFor } from '../pbt.fixture';
import { HEAD, HEAD_OVERDRAW, headFor, layoutLine, type HeadShape } from './head';
import { LINE_FLOATS, packLines, visibleRuns, type Line3, type LineRun3 } from './pack';

const RUNS = 300;
const T = timeoutFor(RUNS, 3);

/** Small whole coordinates, so points repeat and segments vanish. */
const point: fc.Arbitrary<Vec3> = fc.tuple(
  fc.integer({ min: -4, max: 4 }), fc.integer({ min: -4, max: 4 }), fc.integer({ min: -4, max: 4 }),
).map(([x, y, z]) => ({ x, y, z }));

const run: fc.Arbitrary<LineRun3> = fc.record({
  points: fc.array(point, { maxLength: 6 }),
  closed: fc.option(fc.boolean(), { nil: undefined }),
}, { requiredKeys: ['points'] });

const fraction = fc.oneof(fc.double({ min: -0.2, max: 1.2, noNaN: true }), fc.constantFrom(0, 1, 0.5));

const headShape: fc.Arbitrary<HeadShape | null | undefined> = fc.oneof(
  fc.constant(undefined), fc.constant(null),
  fc.record({
    lenRatio: fc.double({ min: 0, max: 20, noNaN: true }),
    maxShare: fc.double({ min: 0, max: 1, noNaN: true }),
    aspect: fc.double({ min: 0, max: 2, noNaN: true }),
  }),
);

const line: fc.Arbitrary<Line3> = fc.record({
  runs: fc.array(run, { maxLength: 4 }),
  color: fc.constant([0.2, 0.4, 0.6, 1] as const),
  width: fc.option(fc.double({ min: 0, max: 40, noNaN: true }), { nil: undefined }),
  head: headShape,
  trim: fc.option(fc.record({ start: fraction, end: fraction }, { requiredKeys: [] }), { nil: undefined }),
  model: fc.option(fc.tuple(quat, fc.double({ min: 0.1, max: 10, noNaN: true })).map(([q, s]) => compose({ x: 1, y: -2, z: 3 }, q, { x: s, y: s, z: s })), { nil: undefined }),
}, { requiredKeys: ['runs', 'color'] }).map((l) => {
  const out = { ...l } as Line3 & Record<string, unknown>;
  for (const k of ['width', 'head', 'trim', 'model'] as const) if (out[k] === undefined) delete out[k];
  if ('head' in l && l.head === undefined) delete out.head;
  return out;
});

/** As `packLines` measures, by `Math.hypot`, which keeps a subnormal length a sum of squares would lose. */
const distance = (a: Vec3, b: Vec3): number => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

function runLength(points: readonly Vec3[], closed: boolean): number {
  let total = 0;
  const n = points.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) total += distance(points[i]!, points[(i + 1) % n]!);
  return total;
}

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

describe('visibleRuns, property', () => {
  it('keeps the length the trim names, every point on the line, a head on each open run of an open subpath', () => {
    const seen = tally();
    fc.assert(fc.property(line, (l) => {
      const drawn = l.runs.filter((r) => r.points.length >= 2);
      const total = drawn.reduce((s, r) => s + runLength(r.points, !!r.closed), 0);
      const from = clamp01(l.trim?.start as number ?? 0) * total;
      const to = clamp01(l.trim?.end as number ?? 1) * total;
      const out = visibleRuns(l);
      const kept = out.reduce((s, r) => s + runLength(r.points, r.closed), 0);
      expect(Math.abs(kept - Math.max(0, to - from))).toBeLessThanOrEqual(1e-9 * (1 + total));
      if (out.length > 0) seen.count(l.trim ? 'trimmed' : 'whole');
      if (out.some((r) => r.closed)) seen.count('closed kept');
      for (const r of out) {
        expect(r.points.length).toBeGreaterThanOrEqual(2);
        if (!r.closed) for (let i = 1; i < r.points.length; i++) expect(distance(r.points[i - 1]!, r.points[i]!)).toBeGreaterThan(0);
        if (r.closed || l.head === null || drawn.every((d) => d.closed)) expect(r.headed).toBe(false);
        else if (drawn.every((d) => !d.closed)) expect(r.headed).toBe(true);
        for (const p of r.points) {
          const off = Math.min(...drawn.map((d) => offRun(p, d)));
          expect(off).toBeLessThanOrEqual(1e-9 * (1 + total));
        }
      }
    }), runs(RUNS));
    seen.atLeast('trimmed', 40);
    seen.atLeast('whole', 20);
    seen.atLeast('closed kept', 10);
  }, T);
});

function offRun(p: Vec3, r: LineRun3): number {
  const n = r.points.length;
  let best = Infinity;
  for (let i = 0; i < (r.closed ? n : n - 1); i++) {
    best = Math.min(best, distance(p, closestPointOnSegment(p, r.points[i]!, r.points[(i + 1) % n]!)));
  }
  return best;
}

describe('packLines, property', () => {
  it('packs six vertices a segment and three a head, finite, with lengths measured along each run', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(line, { maxLength: 3 }), (lines) => {
      const packed = packLines(lines);
      const visible = lines.flatMap((l) => visibleRuns(l).map((r) => ({ r, head: l.head === undefined ? HEAD : l.head })));
      const want = visible.reduce((s, { r }) => {
        const segments = r.closed ? r.points.length : r.points.length - 1;
        return s + 6 * segments + (r.headed ? 3 : 0);
      }, 0);
      expect(packed.length).toBe(want * LINE_FLOATS);
      expect(packed.every(Number.isFinite)).toBe(true);
      if (visible.some(({ r }) => r.headed)) seen.count('headed');
      let at = 0;
      for (const { r } of visible) {
        const segments = r.closed ? r.points.length : r.points.length - 1;
        const total = Math.fround(runLength(r.points, r.closed));
        let last = 0;
        for (let i = 0; i < segments; i++) {
          const count = 6 + (r.headed && i === segments - 1 ? 3 : 0);
          for (let k = 0; k < count; k++) {
            const v = packed.subarray(at * LINE_FLOATS, (at + 1) * LINE_FLOATS);
            expect(v[11]).toBeGreaterThanOrEqual(last * (1 - 1e-6) - 1e-6);
            expect(v[12]).toBeGreaterThanOrEqual(v[11]!);
            expect(Math.abs(v[13]! - total)).toBeLessThanOrEqual(1e-5 * (1 + total));
            expect(v[12]).toBeLessThanOrEqual(v[13]! * (1 + 1e-6) + 1e-6);
            at++;
          }
          last = packed[(at - 1) * LINE_FLOATS + 11]!;
        }
        seen.count('run');
      }
    }), runs(RUNS));
    seen.atLeast('headed', 40);
    seen.atLeast('run', 100);
  }, T);
});

const shape: fc.Arbitrary<HeadShape> = fc.record({
  lenRatio: fc.double({ min: 0, max: 20, noNaN: true }),
  maxShare: fc.double({ min: 0, max: 1, noNaN: true }),
  aspect: fc.double({ min: 0, max: 2, noNaN: true }),
});
const nonNeg = fc.oneof(fc.double({ min: 0, max: 1e6, noNaN: true }), fc.constantFrom(0, 1e-300, 1e300));

describe('headFor and layoutLine, property', () => {
  it('cap the head at its share of the line, keep its shape, and never let the shaft outgrow it', () => {
    fc.assert(fc.property(nonNeg, fc.oneof(nonNeg, fc.constant(Infinity)), shape, nonNeg, (half, linePx, head, more) => {
      const size = headFor(half, linePx, head);
      expect([size.headLen, size.headHalf, size.shaftHalf].every(Number.isFinite)).toBe(true);
      expect(size.headLen).toBeGreaterThanOrEqual(0);
      expect(size.headLen).toBeLessThanOrEqual(half * head.lenRatio);
      if (head.maxShare === 0) expect(size.headLen).toBe(0);
      else expect(size.headLen).toBeLessThanOrEqual(head.maxShare * linePx);
      expect(size.headHalf).toBe(size.headLen * head.aspect);
      expect(size.shaftHalf).toBeLessThanOrEqual(half);
      if (half * head.lenRatio > 0) expect(size.shaftHalf).toBeLessThanOrEqual(size.headHalf);
      expect(headFor(half, linePx + more, head).headLen).toBeGreaterThanOrEqual(size.headLen);
    }), runs(RUNS));
  }, T);

  it('gives a head allowed no share of an endless line no length, not NaN (shrunk)', () => {
    expect(headFor(0, Infinity, { lenRatio: 0, maxShare: 0, aspect: 0 })).toEqual({ headLen: 0, headHalf: 0, shaftHalf: 0 });
    expect(headFor(2, undefined, { ...HEAD, maxShare: 0 })).toEqual({ headLen: 0, headHalf: 0, shaftHalf: 0 });
  });

  it('stop the shaft inside the line, under the head by all but its overdraw', () => {
    const seen = tally();
    fc.assert(fc.property(nonNeg, nonNeg, nonNeg, fc.option(shape, { nil: null }), (half, length, pxPerUnit, head) => {
      const out = layoutLine(half, length, pxPerUnit, head);
      expect([out.headLen, out.headHalf, out.shaftHalf, out.shaftEnd].every(Number.isFinite)).toBe(true);
      expect(out.shaftEnd).toBeLessThanOrEqual(length);
      expect(out.shaftEnd).toBeGreaterThanOrEqual(-1e-12 * length);
      if (head && pxPerUnit > 0) {
        const gap = (length - out.shaftEnd) * pxPerUnit;
        expect(Math.abs(gap - out.headLen * (1 - HEAD_OVERDRAW))).toBeLessThanOrEqual(1e-9 * (1 + out.headLen + length * pxPerUnit));
        if (out.headLen > 0) seen.count('headed');
      }
    }), runs(RUNS));
    seen.atLeast('headed', 8);
  }, T);
});
