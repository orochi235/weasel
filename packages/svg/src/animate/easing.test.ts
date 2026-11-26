import { describe, expect, it } from 'vitest';
import { cssTimingOf, lottieTangentsOf, smilTimingOf } from './easing';

describe('cssTimingOf', () => {
  it('writes linear for none and for linear', () => {
    expect(cssTimingOf(undefined)).toBe('linear');
    expect(cssTimingOf('linear')).toBe('linear');
  });
  it('writes a bezier as cubic-bezier', () => {
    expect(cssTimingOf({ bezier: [0.4, 0, 0.2, 1] })).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
  });
  it('writes steps, defaulting the jump to end', () => {
    expect(cssTimingOf({ steps: 3, jump: 'none' })).toBe('steps(3, jump-none)');
    expect(cssTimingOf({ steps: 2 })).toBe('steps(2, jump-end)');
  });
  it('writes blits points with percentage inputs', () => {
    expect(cssTimingOf({ linear: [0, [0.8, 0.5], 1] })).toBe('linear(0, 0.8 50%, 1)');
    expect(cssTimingOf({ linear: [0, [0.5, 0.25, 0.75], 1] })).toBe('linear(0, 0.5 25% 75%, 1)');
  });
  it('samples a named curve with no CSS form into 25 points', () => {
    const css = cssTimingOf('easeOutBack');
    expect(css).toMatch(/^linear\(/);
    expect(css.split(',')).toHaveLength(25);
    expect(css.startsWith('linear(0, ')).toBe(true);
    expect(css.endsWith(', 1)')).toBe(true);
  });
});

describe('smilTimingOf', () => {
  it('maps linear and bezier', () => {
    expect(smilTimingOf(undefined)).toEqual({ calcMode: 'linear' });
    expect(smilTimingOf({ bezier: [0.4, 0, 0.2, 1] })).toEqual({ calcMode: 'spline', keySpline: '0.4 0 0.2 1' });
  });
  it('maps a single end step to discrete', () => {
    expect(smilTimingOf({ steps: 1, jump: 'end' })).toEqual({ calcMode: 'discrete' });
    expect(smilTimingOf({ steps: 1 })).toEqual({ calcMode: 'discrete' });
  });
  it('expands multiple steps into a staircase over 0..1', () => {
    expect(smilTimingOf({ steps: 2 }).expand).toEqual([
      { t: 0, v: 0 },
      { t: 0.5, v: 0 },
      { t: 0.5, v: 0.5 },
      { t: 1, v: 0.5 },
      { t: 1, v: 1 },
    ]);
  });
  it('expands blits points to exactly their breakpoints', () => {
    expect(smilTimingOf({ linear: [0, [0.8, 0.5], 1] }).expand).toEqual([
      { t: 0, v: 0 }, { t: 0.5, v: 0.8 }, { t: 1, v: 1 },
    ]);
  });
  it('places a three-element point as a hold and spaces bare outputs evenly', () => {
    expect(smilTimingOf({ linear: [0, [0.5, 0.2, 0.6], 0.7, 1] }).expand).toEqual([
      { t: 0, v: 0 }, { t: 0.2, v: 0.5 }, { t: 0.6, v: 0.5 }, { t: 0.8, v: 0.7 }, { t: 1, v: 1 },
    ]);
  });
  it('clamps an input below the one before it', () => {
    expect(smilTimingOf({ linear: [0, [0.5, 0.6], [0.7, 0.4], 1] }).expand).toEqual([
      { t: 0, v: 0 }, { t: 0.6, v: 0.5 }, { t: 0.6, v: 0.7 }, { t: 1, v: 1 },
    ]);
  });
  it('expands a named curve with its endpoints', () => {
    const { expand } = smilTimingOf('easeInQuad');
    expect(expand).toHaveLength(25);
    expect(expand![0]).toEqual({ t: 0, v: 0 });
    expect(expand![24]).toEqual({ t: 1, v: 1 });
    expect(expand![12].v).toBeCloseTo(0.25);
  });
});

describe('lottieTangentsOf', () => {
  it('maps a bezier to tangents', () => {
    expect(lottieTangentsOf({ bezier: [0.4, 0, 0.2, 1] })).toEqual({ o: { x: 0.4, y: 0 }, i: { x: 0.2, y: 1 } });
  });
  it('maps linear to straight tangents', () => {
    expect(lottieTangentsOf(undefined)).toEqual({ o: { x: 0, y: 0 }, i: { x: 1, y: 1 } });
  });
  it('holds for a single end step', () => {
    expect(lottieTangentsOf({ steps: 1, jump: 'end' })).toEqual({ hold: true });
  });
  it('expands blits points to exactly their breakpoints', () => {
    expect(lottieTangentsOf({ linear: [0, [0.8, 0.5], 1] })).toEqual({
      expand: [{ t: 0, v: 0 }, { t: 0.5, v: 0.8 }, { t: 1, v: 1 }],
    });
  });
});
