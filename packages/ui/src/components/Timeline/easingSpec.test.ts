import { describe, expect, it } from 'vitest';
import { easeOutBack } from '@weasel-js/core';
import { easingBezier, easingLabel, sampleEasing } from './easingSpec';

describe('easingLabel', () => {
  it('labels no easing as linear', () => {
    expect(easingLabel(undefined)).toBe('linear');
  });

  it('labels a name as itself', () => {
    expect(easingLabel('easeOutBack')).toBe('easeOutBack');
  });

  it('labels a bezier by its control points', () => {
    expect(easingLabel({ bezier: [0.4, 0, 0.2, 1] })).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
  });

  it('recovers the name of a built-in passed as a function', () => {
    expect(easingLabel(easeOutBack)).toBe('easeOutBack');
  });

  it('labels an unrecognized function as custom', () => {
    expect(easingLabel((t: number) => t * t)).toBe('custom');
  });
});

describe('easingBezier', () => {
  it('returns the control points of a bezier spec', () => {
    expect(easingBezier({ bezier: [0.4, 0, 0.2, 1] })).toEqual([0.4, 0, 0.2, 1]);
  });

  it('returns null for anything without control points', () => {
    expect(easingBezier(undefined)).toBeNull();
    expect(easingBezier('easeOutBack')).toBeNull();
    expect(easingBezier((t: number) => t)).toBeNull();
  });
});

describe('sampleEasing', () => {
  it('returns the requested number of samples', () => {
    expect(sampleEasing('easeInQuad', 11)).toHaveLength(11);
  });

  it('spans 0 to 1 at the ends', () => {
    const s = sampleEasing('easeInQuad', 11);
    expect(s[0]).toBeCloseTo(0, 6);
    expect(s[10]).toBeCloseTo(1, 6);
  });

  it('samples the curve, not the input', () => {
    // easeInQuad at 0.5 is 0.25.
    expect(sampleEasing('easeInQuad', 3)[1]).toBeCloseTo(0.25, 6);
  });

  it('samples undefined as linear', () => {
    expect(sampleEasing(undefined, 3)[1]).toBeCloseTo(0.5, 6);
  });
});
