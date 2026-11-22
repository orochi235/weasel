import { describe, expect, it } from 'vitest';
import { createHostedAnimator } from '../createHostedAnimator';
import { createTarget } from '../target';

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

describe('a pass started at its end to play backward', () => {
  it('does not end forward on a frame that has not moved the clock', () => {
    const a = hosted();
    const passes: number[] = [];
    let done = false;
    a.follow(0, 1);
    a.animator.loop((i, next) => {
      passes.push(i);
      return a.animator.tween({ from: 0, to: 100, ms: 100, easing: 'linear', onTick: () => {}, onDone: next });
    }, { count: 3, onDone: () => { done = true; } });
    a.follow(150, 1);
    a.follow(90, -1);
    a.follow(90, -1);
    a.follow(90, -1);
    expect(passes).toEqual([0, 1, 0]);
    expect(done).toBe(false);
  });

  it('does not end forward on a target either', () => {
    const a = hosted();
    let value = 0;
    const target = createTarget({ get: () => value, set: (v: number) => { value = v; } });
    let done = false;
    a.follow(0, 1);
    a.animator.loop((_i, next) => a.animator.tween({ target, from: 0, to: 100, ms: 100, easing: 'linear', onDone: next }),
      { count: 3, onDone: () => { done = true; } });
    a.follow(150, 1);
    a.follow(90, -1);
    a.follow(90, -1);
    a.follow(90, -1);
    expect(done).toBe(false);
  });
});
