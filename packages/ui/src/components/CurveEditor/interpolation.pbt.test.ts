/**
 * Property tests of the curve editor's samplers: every mode passes through every anchor at its slot and gives
 * `(n - 1) * samplesPerSegment + 1` finite points, for any finite anchors (repeated ones and ones near the double
 * range included); linear samples lie on their chord; and monotone samples never leave their segment's box.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { finite, runs, tally, timeoutFor } from '../../pbt.fixture';
import { sampleByInterpolation, type InterpolationMode } from './interpolation';
import type { Point } from './catmullRom';

const RUNS = 300;
const MODES: InterpolationMode[] = ['linear', 'catmull-rom', 'catmull-rom-uniform', 'catmull-rom-chordal', 'monotone'];

const coord = fc.oneof(finite, fc.constantFrom(0, 1, -1, 1e308, -1e308, 5e-324));
const point = fc.record({ x: coord, y: coord });
/** Anchors with repeats drawn often: a run of the same point is what a double-click leaves. */
const anchors = fc.array(fc.oneof(point, fc.constant({ x: 0, y: 0 })), { minLength: 2, maxLength: 6 })
  .chain((ps) => fc.array(fc.nat({ max: ps.length - 1 }), { maxLength: 2 })
    .map((dups) => { const out = [...ps]; for (const d of dups) out.splice(d, 0, ps[d]!); return out; }));
const tame = fc.array(fc.record({ x: fc.integer({ min: -1000, max: 1000 }), y: fc.integer({ min: -1000, max: 1000 }) }), { minLength: 2, maxLength: 6 });
const per = fc.integer({ min: 1, max: 8 });

describe('sampleByInterpolation', () => {
  it('passes through every anchor at its slot, with one finite point per sample', () => {
    const t = tally();
    fc.assert(fc.property(anchors, per, fc.constantFrom(...MODES), (as, n, mode) => {
      const out = sampleByInterpolation(as, n, mode);
      expect(out).toHaveLength((as.length - 1) * n + 1);
      as.forEach((a, i) => expect(out[i * n]).toEqual(a));
      for (const p of out) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
      if (as.some((a, i) => i > 0 && a.x === as[i - 1]!.x && a.y === as[i - 1]!.y)) t.count('repeat');
      if (as.some((a) => Math.abs(a.x) > 1e300 || Math.abs(a.y) > 1e300)) t.count('huge');
      t.count(mode);
    }), runs(RUNS));
    for (const m of MODES) t.atLeast(m, 20);
    t.atLeast('repeat', 30);
    t.atLeast('huge', 30);
  }, timeoutFor(RUNS, 2));

  it('takes a fractional or non-finite sample count as the whole count below it, and at least one', () => {
    const t = tally();
    fc.assert(fc.property(tame, fc.oneof(fc.double({ min: -3, max: 9, noNaN: true }), fc.constantFrom(Number.NaN, Infinity, -Infinity)), fc.constantFrom(...MODES), (as, n, mode) => {
      const whole = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
      expect(sampleByInterpolation(as, n, mode)).toEqual(sampleByInterpolation(as, whole, mode));
      t.count(Number.isInteger(n) ? 'whole' : 'fraction');
    }), runs(RUNS));
    t.atLeast('fraction', 50);
  }, timeoutFor(RUNS, 2));

  it('lays linear samples on their chord, evenly', () => {
    fc.assert(fc.property(tame, per, (as, n) => {
      const out = sampleByInterpolation(as, n, 'linear');
      for (let i = 0; i < as.length - 1; i++) {
        const a = as[i]!, b = as[i + 1]!;
        for (let s = 0; s <= n; s++) {
          const p = out[i * n + s]!;
          expect(p.x).toBeCloseTo(a.x + ((b.x - a.x) * s) / n, 9);
          expect(p.y).toBeCloseTo(a.y + ((b.y - a.y) * s) / n, 9);
        }
      }
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('keeps monotone samples inside each segment\'s box, so a run of rising anchors rises throughout', () => {
    const t = tally();
    fc.assert(fc.property(tame, per, (as, n) => {
      const out = sampleByInterpolation(as, n, 'monotone');
      const within = (v: number, a: number, b: number) =>
        v >= Math.min(a, b) - 1e-9 * (1 + Math.abs(a) + Math.abs(b)) && v <= Math.max(a, b) + 1e-9 * (1 + Math.abs(a) + Math.abs(b));
      for (let i = 0; i < as.length - 1; i++) {
        const a = as[i]!, b = as[i + 1]!;
        for (let s = 0; s <= n; s++) {
          const p: Point = out[i * n + s]!;
          expect(within(p.x, a.x, b.x) && within(p.y, a.y, b.y)).toBe(true);
        }
      }
      const ys = as.map((a) => a.y);
      if (ys.every((y, i) => i === 0 || y > ys[i - 1]!)) {
        t.count('rising');
        for (let k = 1; k < out.length; k++) expect(out[k]!.y).toBeGreaterThanOrEqual(out[k - 1]!.y - 1e-9);
      }
    }), runs(RUNS));
    t.atLeast('rising', 10);
  }, timeoutFor(RUNS, 1));
});
