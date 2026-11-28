import { describe, expect, it } from 'vitest';
import { createHostedAnimator } from '../createHostedAnimator';
import { createTarget, stateOf } from '../target';

/** A point held on x, with a tween under it canceled halfway, so its rest waits beside. */
function withBeside() {
  let now = 0;
  const h = createHostedAnimator({ now: () => now, requestFrame: () => {} });
  const tick = (t: number): void => { now = t; h.tick(t); };
  let value = { x: 0, y: 0 };
  const target = createTarget({ get: () => value, set: (v: { x: number; y: number }) => { value = v; } });
  h.animator.hold({ target, value: { x: 70, y: 0 }, axes: [0] });
  tick(0);
  const tween = h.animator.tween({ target, from: { x: 0, y: 30 }, to: { x: 0, y: 0 }, ms: 100, easing: 'linear' });
  tick(1);
  tick(51);
  tween.cancel();
  expect(stateOf(target).beside).not.toBeNull();
  return { animator: h.animator, target, tick };
}

describe('a coast started with `from` beside a hold', () => {
  it('starts at `from`, as a spring does', () => {
    const { animator, target } = withBeside();
    animator.spring({ target, from: { x: 0, y: 200 }, to: { x: 0, y: 300 } });
    expect(target.read().y).toBeCloseTo(200, 6);
  });

  it('starts at `from` and ends where it stopped', () => {
    const { animator, target, tick } = withBeside();
    const coast = animator.decay({ target, from: { x: 0, y: 200 }, velocity: { x: 0, y: 100 } });
    expect(target.read().y).toBeCloseTo(200, 6);
    tick(151);
    const shown = target.read().y;
    expect(shown).toBeGreaterThan(200);
    coast.cancel();
    expect(target.read().y).toBeCloseTo(shown, 6);
  });
});
