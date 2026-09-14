import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSTRAINTS } from './color/generate';
import { hueGap, toLch } from './color/oklch';
import { categoricalRamp, lightnessRamp } from './ramps';

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
const PROPOSED = ['#f5f6f7', '#e0e1e4', '#c6c8cb', '#a7a9ae', '#85888e', '#64676f', '#464a51', '#2f3137', '#1c1e22', '#0c0e12'];
const GRAY = { steps: STEPS, lightness: [0.973, 0.163] as const, curve: 0.41, hue: 266, peak: 0.0116, darkBias: 0.84 };

describe('lightnessRamp', () => {
  it('reproduces the proposed gray ramp from its fitted parameters', () => {
    const ramp = lightnessRamp(GRAY);
    STEPS.forEach((s, i) => {
      const got = toLch(ramp[s]);
      const want = toLch(PROPOSED[i]);
      expect(Math.abs(got.L - want.L), `L at ${s}`).toBeLessThanOrEqual(0.01);
      expect(Math.abs(got.C - want.C), `C at ${s}`).toBeLessThanOrEqual(0.003);
    });
  });

  it('walks lightness monotonically and stays in gamut', () => {
    const ramp = lightnessRamp(GRAY);
    const ls = STEPS.map((s) => toLch(ramp[s]).L);
    for (let i = 1; i < ls.length; i += 1) expect(ls[i]).toBeLessThan(ls[i - 1]);
    for (const s of STEPS) expect(ramp[s]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('emits an anchored step exactly and takes its hue from the anchor', () => {
    const ramp = lightnessRamp({ ...GRAY, steps: ['soft', 'base', 'strong'], lightness: [0.252, 0.471], curve: 0, anchor: { base: '#2E1F7A' } });
    expect(ramp.base).toBe('#2e1f7a');
    expect(hueGap(toLch(ramp.strong).H, toLch('#2e1f7a').H)).toBeLessThan(3);
  });
});

describe('categoricalRamp', () => {
  it('names the generated set by step, in generation order', () => {
    const steps = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const { colors, feasible } = categoricalRamp(steps, DEFAULT_CONSTRAINTS, []);
    expect(feasible).toBe(true);
    expect(Object.keys(colors)).toEqual(steps);
    expect(new Set(Object.values(colors)).size).toBe(10);
  });
});
