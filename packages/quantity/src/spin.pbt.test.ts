import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { canSpin, clampToBounds, snapToStep, spinKey, COARSE_STEPS, type SpinBounds } from './spin';
import { decimalPlaces } from './places';
import type { Endless } from './endless';
import { finite, runs, timeoutFor } from './pbt.fixture';

const RUNS = runs(200);
const TIMEOUT = timeoutFor(200, 2);

const step = fc.constantFrom(0.001, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 100, 0.125, 1.5e-7);
const KEYS = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'] as const;
type Key = typeof KEYS[number];

/** The value `i` steps from zero, written with the step's places. */
const at = (i: number, s: number) => Number((i * s).toFixed(decimalPlaces(s)));

/**
 * A grid of `step`, with bounds on it or absent, and an end or both endless. The model counts in steps: index
 * `max + 1` is +Infinity on an endless max, `min - 1` is −Infinity on an endless min.
 */
const grid = fc.record({
  step,
  lo: fc.option(fc.integer({ min: -200, max: 0 }), { nil: undefined }),
  span: fc.integer({ min: 0, max: 200 }),
  hiAbsent: fc.boolean(),
  endless: fc.constantFrom<Endless | undefined>(undefined, 'max', 'min', 'both'),
}).map(({ step, lo, span, hiAbsent, endless }) => {
  const min = lo === undefined && endless !== 'min' && endless !== 'both' ? undefined : (lo ?? 0);
  const max = hiAbsent && endless !== 'max' && endless !== 'both' ? undefined : (min ?? 0) + span;
  return { step, min, max, endless };
});

interface Grid { step: number; min: number | undefined; max: number | undefined; endless: Endless | undefined }

const boundsOf = (g: Grid): SpinBounds => ({
  step: g.step,
  ...(g.min === undefined ? {} : { min: at(g.min, g.step) }),
  ...(g.max === undefined ? {} : { max: at(g.max, g.step) }),
  ...(g.endless === undefined ? {} : { endless: g.endless }),
});

const up = (g: Grid) => g.endless === 'max' || g.endless === 'both';
const down = (g: Grid) => g.endless === 'min' || g.endless === 'both';

/** Where `key` takes index `i` in the model, or null for a key with no bound to go to. */
function model(g: Grid, i: number, key: Key): number | null {
  const top = g.max === undefined ? Infinity : g.max + (up(g) ? 1 : 0);
  const bottom = g.min === undefined ? -Infinity : g.min - (down(g) ? 1 : 0);
  if (key === 'Home') return g.min === undefined ? null : bottom;
  if (key === 'End') return g.max === undefined ? null : top;
  const by = { ArrowUp: 1, ArrowDown: -1, PageUp: COARSE_STEPS, PageDown: -COARSE_STEPS }[key];
  let j = Math.min(top, Math.max(bottom, i + by));
  // A step that would carry a value past an endless bound lands on the bound first.
  if (up(g) && g.max !== undefined && i < g.max && j > g.max) j = g.max;
  if (down(g) && g.min !== undefined && i > g.min && j < g.min) j = g.min;
  return j;
}

const valueOf = (g: Grid, i: number) =>
  up(g) && g.max !== undefined && i > g.max ? Infinity : down(g) && g.min !== undefined && i < g.min ? -Infinity : at(i, g.step);

describe('spinKey, property', () => {
  it('moves along the step grid as a count of steps would, through any run of keys', () => {
    const tally = new Map<string, number>();
    const count = (what: string) => tally.set(what, (tally.get(what) ?? 0) + 1);
    const start = grid.chain((g) => fc.tuple(
      fc.constant(g),
      fc.integer({ min: g.min === undefined ? -300 : g.min, max: g.max === undefined ? 300 : g.max }),
      fc.array(fc.constantFrom(...KEYS), { minLength: 1, maxLength: 40 }),
    ));
    fc.assert(fc.property(start, ([g, i0, keys]) => {
      const bounds = boundsOf(g);
      let i = i0;
      let v = at(i0, g.step);
      for (const key of keys) {
        const want = model(g, i, key);
        const got = spinKey(key, v, bounds);
        if (want === null) {
          expect(got, `${key} from ${v} in ${JSON.stringify(bounds)}`).toBeNull();
          continue;
        }
        const expected = valueOf(g, want);
        expect(got, `${key} from ${v} in ${JSON.stringify(bounds)}`).toBe(expected);
        expect(canSpin(key, v, bounds)).toBe(expected !== v);
        if (!Number.isFinite(expected)) count('infinity');
        else if (expected !== v && want !== i) count('moved');
        else count('held');
        i = want;
        v = expected;
      }
    }), RUNS);
    for (const what of ['infinity', 'moved', 'held']) expect(tally.get(what) ?? 0, what).toBeGreaterThan(RUNS.numRuns / 20);
  }, TIMEOUT);

  it('returns where it started after a step up and a step down, away from the bounds', () => {
    fc.assert(fc.property(step, fc.integer({ min: -1e6, max: 1e6 }), fc.constantFrom(['ArrowUp', 'ArrowDown'], ['PageUp', 'PageDown']), (s, i, [there, back]) => {
      const v = at(i, s);
      const next = spinKey(there!, v, { step: s })!;
      expect(spinKey(back!, next, { step: s }), `${there} from ${v}, step ${s}`).toBe(v);
    }), RUNS);
  });

  it('keeps any value within its bounds, off the grid or not', () => {
    fc.assert(fc.property(grid, finite(1e4), fc.constantFrom(...KEYS), (g, from, key) => {
      const bounds = boundsOf(g);
      const got = spinKey(key, from, bounds);
      if (got === null || !Number.isFinite(got)) return;
      if (bounds.min !== undefined && from >= bounds.min) expect(got).toBeGreaterThanOrEqual(bounds.min);
      if (bounds.max !== undefined && from <= bounds.max) expect(got).toBeLessThanOrEqual(bounds.max);
    }), RUNS);
  });
});

describe('snapToStep and clampToBounds, property', () => {
  it('snaps to the nearest grid point, and a snapped value stays put', () => {
    fc.assert(fc.property(finite(1e5), step, fc.constantFrom(0, 0.05, 1, -0.3, 2.5), (n, s, origin) => {
      const got = snapToStep(n, s, origin);
      expect(snapToStep(got, s, origin), `${n} at ${s} from ${origin}`).toBe(got);
      expect(Math.abs(got - n), `${n} at ${s} from ${origin}`).toBeLessThanOrEqual(s / 2 * (1 + 1e-9) + Math.abs(n) * 1e-12);
      const k = (got - origin) / s;
      expect(Math.abs(k - Math.round(k))).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(k)));
    }), RUNS);
  });

  it('snaps a value and its mirror about the origin to mirrored grid points', () => {
    fc.assert(fc.property(fc.integer({ min: -1e6, max: 1e6 }), step, (i, s) => {
      const n = at(i, s / 4);
      const a = snapToStep(n, s);
      const b = snapToStep(-n, s);
      expect(a === -b, `${n} → ${a}, ${-n} → ${b}`).toBe(true);
    }), RUNS);
  });

  it('clamps idempotently into the bounds, keeping only the infinity an endless end allows', () => {
    const bound = fc.option(finite(1e4), { nil: undefined });
    const value = fc.oneof(finite(1e5), fc.constantFrom(Infinity, -Infinity));
    fc.assert(fc.property(bound, bound, fc.constantFrom<Endless | undefined>(undefined, 'min', 'max', 'both'), value, (a, b, endless, n) => {
      const min = a !== undefined && b !== undefined ? Math.min(a, b) : a;
      const max = a !== undefined && b !== undefined ? Math.max(a, b) : b;
      const bounds = { step: 1, min, max, endless };
      const got = clampToBounds(n, bounds);
      expect(clampToBounds(got, bounds)).toBe(got);
      const allowed = (got === Infinity && (endless === 'max' || endless === 'both')) || (got === -Infinity && (endless === 'min' || endless === 'both'));
      if (!allowed) {
        if (min !== undefined) expect(got).toBeGreaterThanOrEqual(min);
        if (max !== undefined) expect(got).toBeLessThanOrEqual(max);
      }
    }), RUNS);
  });
});
