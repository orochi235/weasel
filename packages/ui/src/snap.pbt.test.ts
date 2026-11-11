/**
 * Property tests of the snapping helpers: `snapToNearest`, the slider track's `catchStop`, and `trackPlace`, the
 * native range input laid over a linear, log, or square-root scale.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { linearScale, logScale, powScale, type ContinuousScaleFactory } from '@weasel-js/plot/scales';
import { snapToNearest } from './snap';
import { catchStop } from './components/Properties/sliderStops';
import { trackPlace } from './components/Properties/sliderScale';
import { finite, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

describe('snapToNearest', () => {
  it('answers the value, or the nearest candidate within the tolerance', () => {
    const t = tally();
    const near = fc.double({ min: -100, max: 100, noNaN: true });
    fc.assert(fc.property(near, fc.array(near, { maxLength: 8 }), fc.double({ min: 0, max: 50, noNaN: true }), (v, cs, tol) => {
      const out = snapToNearest(v, cs, tol);
      const inside = cs.filter((c) => Math.abs(c - v) <= tol);
      if (inside.length === 0) { expect(out).toBe(v); t.count('free'); return; }
      t.count('snapped');
      expect(cs).toContain(out);
      expect(Math.abs(out - v)).toBe(Math.min(...inside.map((c) => Math.abs(c - v))));
    }), runs(RUNS));
    t.atLeast('free', 20);
    t.atLeast('snapped', 20);
  }, timeoutFor(RUNS, 1));
});

describe('catchStop', () => {
  it('lands on the first stop the move crosses, else where it was headed', () => {
    const t = tally();
    fc.assert(fc.property(finite, finite, fc.array(finite, { maxLength: 8 }), (from, to, stops) => {
      const out = catchStop(from, to, stops);
      const [lo, hi] = from < to ? [from, to] : [to, from];
      expect(out >= lo && out <= hi).toBe(true);
      const crossed = stops.filter((s) => s > lo && s < hi);
      if (crossed.length === 0) { expect(out).toBe(to); t.count('clear'); return; }
      t.count('caught');
      // 0 and -0 are one stop.
      expect(out === (from < to ? Math.min(...crossed) : Math.max(...crossed))).toBe(true);
    }), runs(RUNS));
    t.atLeast('clear', 20);
    t.atLeast('caught', 20);
  }, timeoutFor(RUNS, 1));
});

const SQRT: ContinuousScaleFactory = (o) => powScale({ ...o, exponent: 0.5 });
const scaled = fc.constantFrom<[string, ContinuousScaleFactory | undefined]>(
  ['linear', undefined], ['log', logScale], ['sqrt', SQRT], ['linear factory', linearScale],
);
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'];

/** A track over a positive span, so a log scale is defined on it. */
const track = fc.record({
  scale: scaled,
  min: fc.oneof(fc.double({ min: 0.001, max: 100, noNaN: true }), fc.constantFrom(0.01, 1, 10)),
  span: fc.oneof(fc.double({ min: 0.01, max: 1e4, noNaN: true }), fc.constantFrom(1, 99, 1000)),
  step: fc.constantFrom(0.001, 0.01, 0.1, 0.5, 1, 5, 25),
  stopFs: fc.array(fc.double({ min: -0.2, max: 1.2, noNaN: true }), { maxLength: 5 }),
}).map(({ scale, min, span, step, stopFs }) => {
  const max = min + span;
  return { name: scale[0], scale: scale[1], min, max, step, stops: stopFs.map((f) => min + f * span) };
});

describe('trackPlace', () => {
  it('keeps the input on 0..1 and values back in min..max, and puts a stop back where it sat', () => {
    const t = tally();
    fc.assert(fc.property(track, fc.double({ min: -0.5, max: 1.5, noNaN: true }), (tr, raw) => {
      const place = trackPlace(tr.scale, tr.min, tr.max, tr.step, tr.stops);
      // A linear track runs in value units, and the native input holds it to min..max itself.
      if (!tr.scale) { expect(place.fromInput(tr.min + raw)).toBe(tr.min + raw); t.count('linear'); return; }
      const v = place.fromInput(raw);
      expect(Number.isFinite(v)).toBe(true);
      expect(v >= tr.min && v <= tr.max).toBe(true);
      t.count(tr.name);
      const u = place.toInput(v);
      expect(u >= 0 && u <= 1).toBe(true);
      expect(place.fraction(v)).toBe(u);
      for (const s of tr.stops) {
        if (s < tr.min || s > tr.max) continue;
        t.count('stop');
        // A stop within rounding of an end shares the end's place on the track, and that place reads as the end.
        const at = place.toInput(s);
        expect(place.fromInput(at)).toBe(at <= 0 ? tr.min : at >= 1 ? tr.max : s);
      }
    }), runs(RUNS));
    for (const n of ['linear', 'log', 'sqrt', 'linear factory']) t.atLeast(n, 20);
    t.atLeast('stop', 40);
  }, timeoutFor(RUNS, 2));

  it('steps a key within min..max, the way the key heads, catching a stop it crosses', () => {
    const t = tally();
    fc.assert(fc.property(track, fc.double({ min: 0, max: 1, noNaN: true }), fc.constantFrom(...KEYS), fc.constantFrom<'ltr' | 'rtl'>('ltr', 'rtl'), (tr, f, key, dir) => {
      fc.pre(tr.scale !== undefined);
      const place = trackPlace(tr.scale, tr.min, tr.max, tr.step, tr.stops);
      const v = tr.min + f * (tr.max - tr.min);
      const out = place.keyStep(key, v, dir);
      expect(out).not.toBeNull();
      const n = out!;
      expect(Number.isFinite(n)).toBe(true);
      expect(n >= tr.min && n <= tr.max).toBe(true);
      const up = key === 'ArrowUp' || key === 'PageUp' || key === 'End' || (key === 'ArrowRight') === (dir === 'ltr') && key.startsWith('Arrow') && (key === 'ArrowRight' || key === 'ArrowLeft');
      if (up) expect(n).toBeGreaterThanOrEqual(v); else expect(n).toBeLessThanOrEqual(v);
      const crossed = tr.stops.filter((s) => s > Math.min(v, n) && s < Math.max(v, n));
      expect(crossed).toEqual([]);
      t.count(n === v ? 'still' : 'moved');
      if (tr.stops.includes(n) && n !== tr.min && n !== tr.max) t.count('on stop');
    }), runs(RUNS));
    t.atLeast('moved', 50);
    t.atLeast('on stop', 5);
  }, timeoutFor(RUNS, 2));
});

describe('trackPlace, shrunk', () => {
  it('puts back the nearer of two stops a hair apart', () => {
    const SQ: ContinuousScaleFactory = (o) => powScale({ ...o, exponent: 0.5 });
    const place = trackPlace(SQ, 0.01, 1.01, 0.001, [0.010000000000000004, 0.01]);
    expect(place.fromInput(place.toInput(0.010000000000000004))).toBe(0.010000000000000004);
  });
});

describe('catchStop, shrunk', () => {
  it('catches 0 and -0 as one stop', () => {
    expect(catchStop(-1, 5e-324, [0, -0]) === 0).toBe(true);
  });
});
