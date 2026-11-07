import { describe, expect, it } from 'vitest';
import { hostAnimator } from './hostAnimator';

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
});
