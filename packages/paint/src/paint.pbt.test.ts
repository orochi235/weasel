import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  dashForStrokeStyle, dashPattern, dashPhase, MAX_DASH_RUNS, resolveScreenLength, scaledDash, strokeDashStyleOf,
} from './paint';
import { runs, tally } from './pbt.fixture';

const RUNS = runs(300);
const len = fc.oneof(fc.constant(0), fc.double({ min: 1e-3, max: 100, noNaN: true }));
const pattern = fc.array(len, { minLength: 1, maxLength: 5 }).filter((d) => d.some((v) => v > 0));

describe('dashPattern, property', () => {
  it('draws solid, non-finite, or the array itself, by SVG\'s rules', () => {
    const t = tally();
    const entry = fc.oneof(len, fc.double({ min: -10, max: 0, noNaN: true }), fc.constantFrom(Number.NaN, Infinity, -Infinity, 0));
    fc.assert(fc.property(fc.option(fc.array(entry, { maxLength: 5 }), { nil: undefined }), (dash) => {
      const got = dashPattern(dash);
      t.count(typeof got === 'string' ? got : 'pattern');
      const want = dash === undefined || dash.length === 0 ? 'solid'
        : !dash.every(Number.isFinite) ? 'non-finite'
        : dash.some((v) => v < 0) || dash.every((v) => v === 0) ? 'solid'
        : dash;
      expect(got).toBe(want);
    }), RUNS);
    for (const k of ['solid', 'non-finite', 'pattern']) t.atLeast(k, 1);
  });

  it('draws a pattern that would cut its line into too many runs as solid', () => {
    fc.assert(fc.property(pattern, fc.double({ min: 0, max: 1e9, noNaN: true }), (dash, length) => {
      const period = dash.reduce((a, b) => a + b, 0);
      const cuts = (length / period) * dash.length;
      expect(dashPattern(dash, length)).toBe(cuts > MAX_DASH_RUNS ? 'solid' : dash);
    }), RUNS);
  });
});

describe('dashPhase, property', () => {
  it('wraps a phase into [0, cycle), a whole number of cycles from where it was', () => {
    fc.assert(fc.property(pattern, fc.double({ min: -1e4, max: 1e4, noNaN: true }), (dash, phase) => {
      const cycle = dash.reduce((a, b) => a + b, 0) * (dash.length % 2 + 1);
      const got = dashPhase(dash, phase);
      expect(got).toBeGreaterThanOrEqual(0);
      expect(got, `${phase} in ${cycle}`).toBeLessThan(cycle);
      const turns = (phase - got) / cycle;
      expect(Math.abs(turns - Math.round(turns))).toBeLessThan(1e-9 * Math.max(1, Math.abs(phase) / cycle));
    }), RUNS);
  });

  it('wraps a phase just below zero into the cycle (shrunk counterexample)', () => {
    expect(dashPhase([1, 2], -1e-17)).toBeLessThan(3);
    expect(dashPhase([1, 2], Number.NaN)).toBe(0);
  });
});

describe('dash styles, property', () => {
  const width = fc.oneof(
    fc.double({ min: 1e-3, max: 1e3, noNaN: true }),
    fc.double({ min: 1e-3, max: 1e3, noNaN: true }).map((px) => ({ px })),
    fc.constantFrom(undefined, 0, -1, Number.NaN),
  );
  const style = fc.constantFrom('solid', 'dashed', 'dotted') as fc.Arbitrary<'solid' | 'dashed' | 'dotted'>;

  it('reads back the style a dash was made for, at the width it was made at', () => {
    fc.assert(fc.property(style, width, (s, w) => {
      expect(strokeDashStyleOf(dashForStrokeStyle(s, w), w)).toBe(s);
    }), RUNS);
  });

  it('scales a stroke\'s dash and offset together, and undoes with the inverse', () => {
    fc.assert(fc.property(
      fc.option(pattern, { nil: undefined }), fc.option(fc.double({ min: -50, max: 50, noNaN: true }), { nil: undefined }),
      fc.double({ min: 0.01, max: 100, noNaN: true }),
      (dash, dashOffset, k) => {
        const s = { ...(dash ? { dash } : {}), ...(dashOffset === undefined ? {} : { dashOffset }) };
        const back = scaledDash(scaledDash(s, k), 1 / k);
        if (dash === undefined && dashOffset === undefined) {
          expect(scaledDash(s, k)).toBe(s);
          return;
        }
        back.dash?.forEach((v, i) => expect(Math.abs(v - dash![i]!)).toBeLessThan(1e-9 * Math.max(1, dash![i]!)));
        if (dashOffset !== undefined) expect(Math.abs(back.dashOffset! - dashOffset)).toBeLessThan(1e-9 * Math.max(1, Math.abs(dashOffset)));
      },
    ), RUNS);
  });
});

describe('resolveScreenLength, property', () => {
  it('passes world units through and divides pixels by a usable scale, never to a non-finite length', () => {
    const scale = fc.oneof(fc.double({ min: -1e3, max: 1e3, noNaN: true }), fc.constantFrom(0, Number.NaN, Infinity, -Infinity));
    fc.assert(fc.property(fc.double({ min: -1e3, max: 1e3, noNaN: true }), scale, (v, k) => {
      expect(resolveScreenLength(v, k)).toBe(v);
      const px = resolveScreenLength({ px: v }, k);
      expect(Number.isFinite(px) || Math.abs(k) < 1e-300).toBe(true);
      if (Number.isFinite(k) && k !== 0) expect(px).toBe(v / k);
    }), RUNS);
  });
});
