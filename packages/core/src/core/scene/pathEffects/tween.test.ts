import { describe, expect, it, vi } from 'vitest';
import { MAX_TWEEN_STEPS, tweenStations, type TweenEffect } from './tween';

const tween = (over: Partial<TweenEffect>): TweenEffect => ({ kind: 'tween', steps: 3, ...over }) as TweenEffect;

describe('tweenStations', () => {
  it('spaces by distance as many as fit short of the end', () => {
    expect(tweenStations(tween({ spaceBy: 'distance', distance: 25 }), 100)).toEqual([0.25, 0.5, 0.75]);
    expect(tweenStations(tween({ spaceBy: 'distance', distance: 30 }), 100)).toEqual([0.3, 0.6, 0.9]);
  });

  it('caps the steps a tiny distance or an endless count asks for', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(tweenStations(tween({ spaceBy: 'distance', distance: 1e-14 }), 1000)).toHaveLength(MAX_TWEEN_STEPS);
    expect(tweenStations(tween({ steps: Infinity }), 1000)).toHaveLength(MAX_TWEEN_STEPS);
    expect(tweenStations(tween({ steps: NaN }), 1000)).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
