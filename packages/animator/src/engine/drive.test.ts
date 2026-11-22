import { describe, expect, it } from 'vitest';
import { createHostedAnimator } from '../createHostedAnimator';

function hosted() {
  let now = 0;
  const h = createHostedAnimator({ now: () => now, requestFrame: () => {} });
  return {
    animator: h.animator,
    tick: (t: number) => { now = t; h.tick(t); },
    follow: (t: number, rate: number) => { now = t; h.follow(t, rate); },
  };
}

describe("the animator's own frames after an outside clock", () => {
  it('run forward again after the outside clock last moved backward', () => {
    const a = hosted();
    a.follow(100, 1);
    a.follow(50, -1);
    const seen: number[] = [];
    let done = false;
    a.animator.tween({ from: 0, to: 100, ms: 100, easing: 'linear', onTick: (v) => seen.push(v), onDone: () => { done = true; } });
    a.tick(60);
    a.tick(110);
    a.tick(170);
    expect(seen.at(-1)).toBe(100);
    expect(done).toBe(true);
  });
});
