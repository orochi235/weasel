import { describe, expect, it } from 'vitest';
import { createHostedAnimator } from '../createHostedAnimator';

describe('a hosted animator following a clock apart from its own', () => {
  it('starts a tween from idle where the followed clock stands, not where now() does', () => {
    const h = createHostedAnimator({ now: () => 50_000, requestFrame: () => {} });
    const seen: number[] = [];
    let done = false;
    h.animator.tween({ from: 0, to: 100, ms: 100, easing: 'linear', onTick: (v) => seen.push(v), onDone: () => { done = true; } });
    h.follow(1200, 1);
    h.follow(1250, 1);
    expect(done).toBe(false);
    expect(seen.at(-1)).toBeCloseTo(50);
  });

  it('moves nothing on the first frame after switching between its own frames and a followed clock', () => {
    let now = 0;
    const h = createHostedAnimator({ now: () => now, requestFrame: () => {} });
    const seen: number[] = [];
    h.animator.tween({ from: 0, to: 1000, ms: 1000, easing: 'linear', onTick: (v) => seen.push(v) });
    h.tick(0);
    h.tick(100);
    h.follow(5000, 1);
    expect(seen.at(-1)).toBeCloseTo(100);
    h.follow(5100, 1);
    expect(seen.at(-1)).toBeCloseTo(200);
    now = 300;
    h.tick(300);
    expect(seen.at(-1)).toBeCloseTo(200);
    h.tick(400);
    expect(seen.at(-1)).toBeCloseTo(300);
  });
});
