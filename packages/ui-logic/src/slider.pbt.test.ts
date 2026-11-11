/**
 * Property tests of slider keys: a keystroke lands inside the thumb's bounds, on the step grid or a bound, moving
 * the way the key points; whole stops when there are stops; between the neighbors when ordered. `usableStops`,
 * `attract`, and `stepStops` against plain models.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { attract, sliderKey, stepStops, usableStops, type SliderKeyShape } from './slider';

const RUNS = 400;
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'a'];

const track = fc.oneof(
  fc.constantFrom<[number, number]>([0, 100], [0, 1], [-50, 50], [10, 11], [0, 0.3], [1e-6, 2e-6], [-1e9, 1e9]),
  fc.tuple(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: 1, max: 2000 })).map(([a, w]): [number, number] => [a, a + w]),
);
const step = fc.option(fc.constantFrom(0.1, 0.25, 0.01, 1, 3, 7, 0.3, 1e-7, 0), { nil: undefined });

const onGrid = (v: number, origin: number, s: number): boolean => {
  const k = (v - origin) / s;
  return Math.abs(k - Math.round(k)) <= 1e-6 * Math.max(1, Math.abs(k));
};

describe('sliderKey', () => {
  it('lands inside the bounds, on a step or a bound, moving the way the key points', () => {
    const t = tally();
    fc.assert(fc.property(
      track.chain(([min, max]) => fc.record({
        min: fc.constant(min), max: fc.constant(max),
        thumbs: fc.array(fc.double({ min, max, noNaN: true }), { minLength: 1, maxLength: 3 }).map((v) => v.sort((a, b) => a - b).map((value) => ({ value }))),
        bounds: fc.option(fc.tuple(fc.double({ min, max, noNaN: true }), fc.double({ min, max, noNaN: true })).map(([a, b]): [number, number] => (a <= b ? [a, b] : [b, a])), { nil: undefined }),
      })),
      step, fc.nat(), fc.constantFrom(...KEYS), fc.boolean(), fc.constantFrom('ltr', 'rtl' as const),
      fc.oneof({ weight: 2, arbitrary: fc.constant(false) }, { weight: 1, arbitrary: fc.constant(true) }),
      (base, s, pick, key, shift, dir, ordered) => {
        const index = pick % base.thumbs.length;
        const shape: SliderKeyShape = {
          thumbs: base.thumbs, index, min: base.min, max: base.max, step: s, dir, ordered,
          ...(base.bounds ? { bounds: () => base.bounds! } : {}),
        };
        const got = sliderKey(key, shift, shape);
        if (key === 'a') { expect(got).toBeNull(); return; }
        expect(got).not.toBeNull();
        const v = got!;
        expect(Number.isFinite(v)).toBe(true);
        const [bLo, bHi] = base.bounds ?? [base.min, base.max];
        const lo = Math.max(base.min, bLo);
        const hi = Math.min(base.max, bHi);
        expect(v).toBeGreaterThanOrEqual(lo);
        expect(v).toBeLessThanOrEqual(hi);
        if (ordered) {
          // Held a gap off each neighbor where there is room for it.
          const gap = s !== undefined && s > 0 ? s : (hi - lo) / 1000;
          const below = index > 0 ? base.thumbs[index - 1]!.value + gap : lo;
          const above = index < base.thumbs.length - 1 ? base.thumbs[index + 1]!.value - gap : hi;
          if (Math.max(lo, below) <= Math.min(hi, above)) {
            expect(v).toBeGreaterThanOrEqual(Math.max(lo, below) - 1e-9);
            expect(v).toBeLessThanOrEqual(Math.min(hi, above) + 1e-9);
          }
          t.count('ordered');
          return;
        }
        const from = base.thumbs[index]!.value;
        if (key === 'Home') { expect(v).toBe(lo); return; }
        if (key === 'End') { expect(v).toBe(hi); return; }
        const up = key === 'ArrowUp' || key === 'PageUp' || key === (dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
        const bound = v === lo || v === hi;
        if (s !== undefined && s > 0 && !bound) {
          expect(onGrid(v, base.min, s)).toBe(true);
          t.count('on step');
        }
        if (from >= lo && from <= hi) {
          // A thumb off the grid snaps onto it, which may take it a little against the key, never past a step.
          const room = s !== undefined && s > 0 ? s : 0;
          if (up) expect(v).toBeGreaterThanOrEqual(from - room / 2 - 1e-9 * Math.abs(from));
          else expect(v).toBeLessThanOrEqual(from + room / 2 + 1e-9 * Math.abs(from));
          t.count(bound ? 'bound' : 'moved');
        }
      },
    ), runs(RUNS));
    t.atLeast('on step', RUNS / 10);
    t.atLeast('moved', RUNS / 10);
    t.atLeast('bound', RUNS / 20);
    t.atLeast('ordered', RUNS / 8);
  }, timeoutFor(RUNS, 2));

  it('with stops, moves by whole stops, or to a bound', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.uniqueArray(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 8 }).map((s) => s.sort((a, b) => a - b)),
      fc.integer({ min: 0, max: 100 }), fc.constantFrom(...KEYS.slice(0, 6)), fc.boolean(),
      (stops, from, key, shift) => {
        const v = sliderKey(key, shift, { thumbs: [{ value: from }], index: 0, min: 0, max: 100, stops })!;
        expect(stops.includes(v)).toBe(true);
        const up = key === 'ArrowUp' || key === 'PageUp' || key === 'ArrowRight';
        const count = key.startsWith('Page') || shift ? 10 : 1;
        expect(v).toBe(stepStops(stops, from, up ? 1 : -1, count));
        t.count(v === from ? 'stayed' : 'moved');
      },
    ), runs(RUNS));
    t.atLeast('moved', RUNS / 3);
  }, timeoutFor(RUNS, 3));
});

describe('stops', () => {
  const stopList = fc.array(fc.oneof(
    fc.integer({ min: -5, max: 15 }),
    fc.record({ value: fc.integer({ min: -5, max: 15 }), label: fc.option(fc.constantFrom('x', 'y', 'z'), { nil: undefined }) }),
  ), { maxLength: 10 });

  it('usableStops keeps those in range, once each, ascending, with the first label given', () => {
    fc.assert(fc.property(stopList, (stops) => {
      const got = usableStops(stops, 0, 10);
      const all = stops.map((s) => (typeof s === 'number' ? { value: s, label: undefined } : s)).filter((s) => s.value >= 0 && s.value <= 10);
      const want = [...new Set(all.map((s) => s.value))].sort((a, b) => a - b)
        .map((value) => ({ value, label: all.find((s) => s.value === value && s.label !== undefined)?.label }));
      expect(got.map((s) => ({ value: s.value, label: s.label }))).toEqual(want);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 3));

  it('attract snaps to the nearest stop within reach, else stays', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 100 }), { maxLength: 6 }), fc.double({ min: 0, max: 100, noNaN: true }), fc.constantFrom(0, 0.01, 0.05, 0.2), (stops, v, tol) => {
      const f = (x: number): number => x / 100;
      const got = attract(v, stops, tol, f);
      const near = stops.filter((s) => Math.abs(f(s) - f(v)) <= tol);
      if (near.length === 0) { expect(got).toBe(v); t.count('stayed'); return; }
      expect(stops.includes(got)).toBe(true);
      expect(Math.abs(f(got) - f(v))).toBe(Math.min(...near.map((s) => Math.abs(f(s) - f(v)))));
      t.count('snapped');
    }), runs(RUNS));
    t.atLeast('snapped', RUNS / 10);
    t.atLeast('stayed', RUNS / 10);
  }, timeoutFor(RUNS, 3));

  it('stepStops goes count stops along, saturating at the ends', () => {
    fc.assert(fc.property(
      fc.uniqueArray(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 8 }).map((s) => s.sort((a, b) => a - b)),
      fc.integer({ min: -5, max: 55 }), fc.constantFrom<1 | -1>(1, -1), fc.integer({ min: 1, max: 12 }),
      (stops, v, dir, count) => {
        const ahead = dir > 0 ? stops.filter((s) => s > v) : stops.filter((s) => s < v).reverse();
        const want = ahead.length === 0 ? (dir > 0 ? stops.at(-1) : stops[0]) : ahead[Math.min(ahead.length - 1, count - 1)];
        expect(stepStops(stops, v, dir, count)).toBe(want);
      },
    ), runs(RUNS));
  }, timeoutFor(RUNS, 3));
});

describe('shrunk counterexamples', () => {
  it('an ordered thumb with no room past its neighbor stays inside its bounds', () => {
    const shape = { thumbs: [{ value: 0 }, { value: 0 }], index: 1, min: 0, max: 1293, step: 0.1, ordered: true, bounds: () => [0, 0] as const };
    expect(sliderKey('ArrowUp', false, shape)).toBe(0);
  });
});

describe('sliderKey with an endless end', () => {
  it('rests in the range on its step grid or on an end stop, and reaches an end stop one press past the range', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.integer({ min: -50, max: 50 }), fc.integer({ min: 1, max: 200 }), fc.constantFrom(1, 3, 7, 10),
      fc.integer({ min: 1, max: 40 }), fc.integer({ min: 1, max: 40 }), fc.constantFrom('min', 'max', 'both' as const),
      fc.nat(), fc.constantFrom('ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'),
      (lo, width, s, gapLo, gapHi, ends, pick, key) => {
        const hi = lo + width;
        const min = ends === 'max' ? lo : lo - gapLo;
        const max = ends === 'min' ? hi : hi + gapHi;
        // Thumbs rest on the grid from the range's start, on the range's ends, or on an end stop.
        const rests = [...Array.from({ length: Math.floor(width / s) + 1 }, (_, k) => lo + k * s), hi, min, max];
        const from = rests[pick % rests.length]!;
        const v = sliderKey(key, false, { thumbs: [{ value: from }], index: 0, min, max, step: s, range: [lo, hi] })!;
        const onGrid = v >= lo && v <= hi && (Number.isInteger((v - lo) / s) || v === hi);
        expect(onGrid || v === min || v === max).toBe(true);
        const up = key.endsWith('Up');
        if (up && from === hi && max > hi) { expect(v).toBe(max); t.count('to end stop'); }
        if (!up && from === lo && min < lo) { expect(v).toBe(min); t.count('to end stop'); }
        if (from === max && max > hi && !up) expect(v).toBeLessThanOrEqual(hi);
        if (from === min && min < lo && up) expect(v).toBeGreaterThanOrEqual(lo);
        t.count(v > min && v < max ? 'in range' : 'end');
      },
    ), runs(RUNS));
    t.atLeast('to end stop', RUNS / 20);
    t.atLeast('in range', RUNS / 4);
  }, timeoutFor(RUNS, 1));
});

describe('shrunk counterexamples, endless end', () => {
  it('a key steps on the range\'s grid when an endless low end\'s stop sits off it', () => {
    const shape = { thumbs: [{ value: 30 }], index: 0, min: -7, max: 100, step: 10, range: [0, 100] as const };
    expect(sliderKey('ArrowUp', false, shape)).toBe(40);
    expect(sliderKey('ArrowDown', false, shape)).toBe(20);
  });
});

describe('shrunk counterexamples, end stop', () => {
  it('Page Down from the high end stop stops at the range\'s low end, not in the gap past it', () => {
    const shape = { thumbs: [{ value: 32 }], index: 0, min: -33, max: 32, step: 7, range: [0, 31] as const };
    expect(sliderKey('PageDown', false, shape)).toBe(0);
  });
});
