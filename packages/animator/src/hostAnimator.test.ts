import { describe, expect, it } from 'vitest';
import { hostAnimator } from './hostAnimator';
import { createTarget } from './target';

describe('hostAnimator', () => {
  it('runs on the frames its host calls, forward and back on a followed clock', () => {
    let now = 0;
    let asked = 0;
    const hosted = hostAnimator({ now: () => now, requestFrame: () => { asked++; } });
    const seen: number[] = [];
    hosted.animator.tween({ from: 0, to: 100, ms: 100, easing: 'linear', onTick: (v) => seen.push(v) });
    expect(asked).toBeGreaterThan(0);
    hosted.follow(0, 1);
    hosted.follow(50, 1);
    hosted.follow(25, -1);
    expect(seen.at(-2)).toBeCloseTo(50);
    expect(seen.at(-1)).toBeCloseTo(25);
    now = 1000;
    hosted.dispose();
    hosted.tick(1000);
    expect(seen.at(-1)).toBeCloseTo(25);
  });

  it('refuses a tween whose ms is NaN at the call, rather than throwing out of every frame after', () => {
    let now = 0;
    const hosted = hostAnimator({ now: () => now, requestFrame: () => {} });
    const { animator } = hosted;
    const seen: number[] = [];
    animator.tween({ from: 0, to: 100, ms: 100, easing: 'linear', onTick: (v) => seen.push(v) });
    let value = 0;
    const target = createTarget({ get: () => value, set: (v) => { value = v; } });
    expect(() => animator.tween({ from: 0, to: 1, ms: Number.NaN, onTick: () => {} })).toThrow(RangeError);
    expect(() => animator.tween({ target, to: 1, ms: Number.NaN })).toThrow(RangeError);
    expect(value).toBe(0);
    for (const t of [0, 50, 100]) {
      now = t;
      hosted.tick(t);
    }
    expect(seen.at(-1)).toBe(100);
  });
});
