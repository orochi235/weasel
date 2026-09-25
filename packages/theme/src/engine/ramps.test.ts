import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSTRAINTS } from './color/generate';
import { chromaCap, hueGap, toLch } from './color/oklch';
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

  it('walks lightness monotonically', () => {
    const ramp = lightnessRamp(GRAY);
    const ls = STEPS.map((s) => toLch(ramp[s]).L);
    for (let i = 1; i < ls.length; i += 1) expect(ls[i]).toBeLessThan(ls[i - 1]);
  });

  it('clamps an out-of-gamut step’s chroma at its lightness and hue, keeping the hue', () => {
    for (const hue of [30, 140, 266]) {
      const ramp = lightnessRamp({ steps: STEPS, lightness: [0.95, 0.25], curve: 0, hue, peak: 0.3, darkBias: 0 });
      for (const s of STEPS) {
        const { L, C, H } = toLch(ramp[s]);
        if (C < 0.02) continue;
        expect(hueGap(H, hue), `hue at ${hue}/${s}`).toBeLessThan(3);
        expect(C, `chroma at ${hue}/${s}`).toBeLessThanOrEqual(chromaCap(L, hue) + 0.02);
      }
    }
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

describe('lightBias', () => {
  const base = { steps: ['a', 'b', 'c', 'd', 'e'], lightness: [0.9, 0.3] as const, curve: 0, hue: 250, peak: 0.1, darkBias: 0 };

  it('leaves a ramp that omits it unchanged', () => {
    expect(lightnessRamp({ ...base, lightBias: 0 })).toEqual(lightnessRamp(base));
  });

  it('lifts the first step off zero chroma', () => {
    expect(toLch(lightnessRamp(base).a).C).toBeLessThan(0.005);
    expect(toLch(lightnessRamp({ ...base, lightBias: 0.5 }).a).C).toBeGreaterThan(0.02);
  });
});

describe('an anchor where the chroma envelope is near zero', () => {
  const base = { steps: ['a', 'b', 'c', 'd', 'e'], lightness: [0.95, 0.3] as const, curve: 0, hue: 0, peak: 0, anchor: { e: '#2e1f7a' } };

  it('keeps the middle step colored as darkBias moves off 0', () => {
    for (const darkBias of [0.001, 0.01, 0.05]) {
      const c = toLch(lightnessRamp({ ...base, darkBias }).c).C;
      expect(c, `darkBias ${darkBias}`).toBeGreaterThan(0.02);
      expect(c, `darkBias ${darkBias}`).toBeLessThan(0.3);
    }
  });
});

describe('an anchor sets the chroma peak directly', () => {
  const steps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
  const gray = (darkBias: number) =>
    lightnessRamp({ steps, lightness: [0.97, 0.2], curve: 0, hue: 0, peak: 0, darkBias, anchor: { '900': '#1f2328' } });

  it('keeps a gray ramp anchored on its last step gray, and continuous as darkBias leaves 0', () => {
    const at0 = toLch(gray(0)['500']).C;
    const nudged = toLch(gray(0.001)['500']).C;
    expect(at0).toBeLessThan(0.02);
    expect(nudged).toBeLessThan(0.02);
    expect(Math.abs(nudged - at0)).toBeLessThan(0.001);
  });
});

describe('several anchors', () => {
  const steps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
  const red = '#ff0000';
  const blue = '#0000ff';
  const ramp = lightnessRamp({
    steps,
    lightness: [0.97, 0.2],
    curve: 0,
    hue: 0,
    peak: 0,
    lightBias: 0.5,
    darkBias: 0.5,
    anchor: { '100': red, '800': blue },
  });
  const hr = toLch(red).H;
  const hb = toLch(blue).H;
  const arc = ((hb - hr + 540) % 360) - 180;

  it('lands each anchored step exactly on its anchor', () => {
    expect(ramp['100']).toBe(red);
    expect(ramp['800']).toBe(blue);
  });

  it('blends hue along the shortest arc between consecutive anchors', () => {
    for (let i = 2; i <= 7; i += 1) {
      const want = (hr + (arc * (i - 1)) / 7 + 360) % 360;
      expect(hueGap(toLch(ramp[steps[i]]).H, want), `hue at ${steps[i]}`).toBeLessThan(4);
    }
  });

  it('holds the first anchor’s hue before it and the last anchor’s after it', () => {
    expect(hueGap(toLch(ramp['50']).H, hr)).toBeLessThan(4);
    expect(hueGap(toLch(ramp['900']).H, hb)).toBeLessThan(4);
  });
});
