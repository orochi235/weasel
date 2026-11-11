/**
 * Property tests of the engine's generators: a lightness ramp is a list of hex colors walking its lightness in
 * order with its anchors exact, a scale takes exactly one rule, and the color helpers' ranges and symmetries.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally } from '../pbt.fixture';
import { contrast, hueGap, toLch } from './color/oklch';
import { lightnessRamp } from './ramps';
import { scale } from './scales';

const RUNS = 300;

const unit = fc.double({ min: 0, max: 1, noNaN: true });
const hex = fc.tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
  .map((cs) => `#${cs.map((c) => c.toString(16).padStart(2, '0')).join('')}`);
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

describe('lightnessRamp', () => {
  it('writes a hex per step, each anchor exactly, lightness walking from one end to the other', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.integer({ min: 3, max: STEPS.length }),
      fc.tuple(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 1000 })).map(([a, b]) => [a / 1000, b / 1000] as const),
      fc.record({ curve: unit, hue: fc.double({ min: -720, max: 720, noNaN: true }), peak: fc.double({ min: 0, max: 0.4, noNaN: true }), darkBias: unit, lightBias: unit }),
      fc.dictionary(fc.constantFrom(...STEPS), hex.map((h) => h.toUpperCase()), { maxKeys: 1 }),
      (n, lightness, p, anchor) => {
        const steps = STEPS.slice(0, n);
        const out = lightnessRamp({ steps, lightness, ...p, anchor });
        expect(Object.keys(out)).toEqual(steps);
        for (const s of steps) expect(out[s]).toMatch(/^#[0-9a-f]{6}$/);
        for (const [s, h] of Object.entries(anchor)) if (steps.includes(s)) expect(out[s]).toBe(h.toLowerCase());
        const free = steps.filter((s) => !Object.hasOwn(anchor, s)).map((s) => toLch(out[s]!).L);
        if (free.length < 2 || Math.abs(lightness[0] - lightness[1]) < 0.05) return;
        t.count('walks');
        const dir = Math.sign(lightness[1] - lightness[0]);
        for (let i = 1; i < free.length; i++) expect((free[i]! - free[i - 1]!) * dir).toBeGreaterThan(-0.01);
      },
    ), runs(RUNS));
    t.atLeast('walks', 100);
  });
});

describe('scale', () => {
  it('takes exactly one rule, and a step rule adds the step each time', () => {
    const n = fc.integer({ min: -100, max: 100 });
    fc.assert(fc.property(fc.integer({ min: 1, max: 6 }), n, fc.option(n, { nil: undefined }), fc.option(fc.double({ min: 0.5, max: 2, noNaN: true }), { nil: undefined }), fc.boolean(), (count, base, step, ratio, factors) => {
      const steps = STEPS.slice(0, count);
      const p = { base, step, ratio, factors: factors ? steps.map((_, i) => i) : undefined };
      const rules = [step, ratio, p.factors].filter((r) => r !== undefined).length;
      if (rules !== 1) {
        expect(() => scale(steps, p)).toThrow('exactly one');
        return;
      }
      const out = scale(steps, p);
      expect(Object.keys(out)).toEqual(steps);
      if (step !== undefined) steps.forEach((s, i) => expect(out[s]).toBe(`${Math.round(base + step * i)}px`));
      for (const v of Object.values(out)) expect(v).toMatch(/^-?\d+px$/);
    }), runs(RUNS));
  });
});

describe('color helpers', () => {
  it('contrast is symmetric, 1 for a color against itself, and within 1 to 21', () => {
    fc.assert(fc.property(hex, hex, (a, b) => {
      expect(contrast(a, b)).toBe(contrast(b, a));
      expect(contrast(a, a)).toBeCloseTo(1, 10);
      expect(contrast(a, b)).toBeGreaterThanOrEqual(1);
      expect(contrast(a, b)).toBeLessThanOrEqual(21 + 1e-9);
    }), runs(RUNS));
  });

  it('a hue gap is symmetric, within 0 to 180, and ignores whole turns', () => {
    const hue = fc.double({ min: -1e4, max: 1e4, noNaN: true });
    fc.assert(fc.property(hue, hue, fc.integer({ min: -5, max: 5 }), (a, b, k) => {
      const g = hueGap(a, b);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(180);
      expect(hueGap(b, a)).toBeCloseTo(g, 6);
      expect(hueGap(a + 360 * k, b)).toBeCloseTo(g, 6);
    }), runs(RUNS));
  });
});
