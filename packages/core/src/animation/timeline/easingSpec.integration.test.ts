import { describe, expect, it } from 'vitest';
import { sampleTrack } from './sampleTrack';
import type { SampledTrack } from './types';

function track(easing: SampledTrack<number>['keys'][number]['easing']): SampledTrack<number> {
  return {
    kind: 'sampled',
    keys: [
      { t: 0, value: 0 },
      { t: 100, value: 100, easing },
    ],
    onTick: () => {},
  };
}

describe('sampleTrack easing specs', () => {
  it('samples with no easing as linear', () => {
    expect(sampleTrack(track(undefined), 50)).toBeCloseTo(50, 6);
  });

  it('accepts a named easing', () => {
    // easeInQuad at u=0.5 is 0.25.
    expect(sampleTrack(track('easeInQuad'), 50)).toBeCloseTo(25, 6);
  });

  it('accepts a bezier easing', () => {
    // Identity control points reproduce linear.
    const v = sampleTrack(track({ bezier: [1 / 3, 1 / 3, 2 / 3, 2 / 3] }), 50);
    expect(v).toBeCloseTo(50, 3);
  });

  it('still accepts a bare function', () => {
    expect(sampleTrack(track((t) => t * t), 50)).toBeCloseTo(25, 6);
  });
});
