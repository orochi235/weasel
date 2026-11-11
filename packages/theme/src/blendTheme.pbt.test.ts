/**
 * Property tests of `blendTheme`: its ends are the selections they name, exactly; scaling every weight changes
 * nothing; a token the same everywhere stays itself; and a length blends to a finite number between its ends.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AxisDefs } from './axes';
import { blendTheme } from './blendTheme';
import { readCssNumber } from './cssNumber';
import { outcome, runs, tally, timeoutFor } from './pbt.fixture';
import { resolveTheme } from './resolveTheme';
import type { Theme } from './theme';

const RUNS = 300;

const AXES: AxisDefs = { mode: { default: 'dark', values: { dark: {}, light: {}, dim: {} } } };
const MODES = ['dark', 'light', 'dim'] as const;

const length = fc.tuple(fc.double({ min: -1e6, max: 1e6, noNaN: true }), fc.constantFrom('px', 'rem', '')).map(([n, u]) => `${n}${u}`);
const value = fc.oneof(length, fc.constantFrom('#ff0000', '#00ff0080', 'rgb(1, 2, 3)', 'transparent', 'solid', 'url(a.png)', '4px', '1.5rem'));

/** A mode-varying theme of literals, one token per name, every mode given a value. */
const blendable: fc.Arbitrary<Theme> = fc
  .dictionary(fc.constantFrom('a', 'b', 'c', 'd'), fc.tuple(value, value, value), { minKeys: 1, maxKeys: 4 })
  .map((byName) => ({
    name: 'blend',
    extends: null,
    axes: AXES,
    tokens: Object.fromEntries(Object.entries(byName).map(([n, vs]) => [n, { by: 'mode', ...Object.fromEntries(MODES.map((m, i) => [m, { type: 'unknown', value: vs[i] }])) }])),
  }));

const n = fc.oneof(fc.double({ min: -1e6, max: 1e6, noNaN: true }), fc.double({ noNaN: true, noDefaultInfinity: true }), fc.integer());
/** The same, with each token a number in one unit throughout. */
const lengths: fc.Arbitrary<Theme> = fc
  .dictionary(fc.constantFrom('a', 'b', 'c', 'd'), fc.tuple(fc.constantFrom('px', 'rem', '', '%'), n, n, n), { minKeys: 1, maxKeys: 4 })
  .map((byName) => ({
    name: 'lengths',
    extends: null,
    axes: AXES,
    tokens: Object.fromEntries(Object.entries(byName).map(([name, [u, ...vs]]) => [name, { by: 'mode', ...Object.fromEntries(MODES.map((m, i) => [m, { type: 'dimension', value: `${vs[i]}${u}` }])) }])),
  }));

const share = fc.oneof(fc.constantFrom(0, 1, 0.5), fc.double({ min: 0, max: 1e6, noNaN: true }), fc.double({ min: 0, noNaN: true }));
const weights = fc.record({ dark: share, light: share, dim: share }, { requiredKeys: [] });

describe('blendTheme', () => {
  it('all the weight on one value is that selection, exactly, whatever weighs nothing', () => {
    fc.assert(fc.property(blendable, fc.constantFrom(...MODES), fc.double({ min: 1e-6, max: 1e6, noNaN: true }), (theme, mode, w) => {
      const zeros = Object.fromEntries(MODES.map((m) => [m, m === mode ? w : 0]));
      expect(blendTheme(theme, { mode: zeros })).toEqual(resolveTheme(theme, { mode }));
    }), runs(RUNS));
  });

  it('weights that give nothing anything leave the selection as it was', () => {
    fc.assert(fc.property(blendable, fc.constantFrom(...MODES), (theme, mode) => {
      expect(blendTheme(theme, { mode: { dark: 0, light: -1 }, other: { x: 1 } }, { mode })).toEqual(resolveTheme(theme, { mode }));
    }), runs(RUNS));
  });

  it('scaling every weight by one factor changes nothing', () => {
    const t = tally();
    fc.assert(fc.property(blendable, weights, fc.constantFrom(2, 4, 0.5, 0.25), (theme, w, k) => {
      const scaled = Object.fromEntries(Object.entries(w).map(([m, x]) => [m, x * k]));
      if (Object.entries(w).some(([m, x]) => !Number.isFinite(scaled[m]!) || scaled[m]! / k !== x)) return;
      const a = outcome(() => blendTheme(theme, { mode: w }));
      const b = outcome(() => blendTheme(theme, { mode: scaled }));
      if (Object.values(w).filter((x) => x > 0).length > 1) t.count('blends');
      expect(b).toEqual(a);
    }), runs(RUNS));
    t.atLeast('blends', 50);
  });

  it('a theme blended with itself is itself', () => {
    fc.assert(fc.property(blendable, weights, fc.constantFrom(...MODES), (theme, w, mode) => {
      const same: Theme = { ...theme, tokens: Object.fromEntries(Object.entries(theme.tokens).map(([n, v]) => {
        const leaf = (v as Record<string, unknown>)[mode];
        return [n, { by: 'mode', dark: leaf, light: leaf, dim: leaf }];
      })) as Theme['tokens'] };
      expect(blendTheme(same, { mode: w })).toEqual(resolveTheme(same, { mode }));
    }), runs(RUNS));
  });

  it('a length blends to a finite number between its ends, in its unit', () => {
    const t = tally();
    fc.assert(fc.property(fc.oneof(lengths, blendable), weights, (theme, w) => {
      const out = blendTheme(theme, { mode: w }) as Record<string, string>;
      const given = MODES.filter((m) => (w[m] ?? 0) > 0);
      if (given.length < 2) return;
      for (const [name, css] of Object.entries(out)) {
        const at = given.map((m) => (resolveTheme(theme, { mode: m }) as Record<string, string>)[name]!);
        const ends = at.map(readCssNumber);
        if (ends.some((e) => e === undefined) || new Set(ends.map((e) => e!.unit)).size > 1 || new Set(at).size === 1) continue;
        t.count('length');
        const got = readCssNumber(css);
        expect(got, css).toBeDefined();
        expect(Number.isFinite(got!.value)).toBe(true);
        expect(got!.unit).toBe(ends[0]!.unit);
        const lo = Math.min(...ends.map((e) => e!.value));
        const hi = Math.max(...ends.map((e) => e!.value));
        expect(got!.value).toBeGreaterThanOrEqual(lo - 1e-4);
        expect(got!.value).toBeLessThanOrEqual(hi + 1e-4);
      }
    }), runs(RUNS));
    t.atLeast('length', 50);
  }, timeoutFor(RUNS, 5));
});
