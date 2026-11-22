import { describe, expect, it } from 'vitest';
import { createHostedAnimator } from '../createHostedAnimator';
import { createTarget, stateOf } from '../target';
import type { PhysicsHandle } from '../types';

function hosted() {
  let now = 0;
  const h = createHostedAnimator({ now: () => now, requestFrame: () => {} });
  return { animator: h.animator, tick: (t: number) => { now = t; h.tick(t); } };
}

/** A held target under a spring toward 50, with a tween's leftover waiting beside the hold. */
function springUnderHold(redirect: (a: ReturnType<typeof hosted>, spring: PhysicsHandle<number>, target: ReturnType<typeof createTarget<number>>) => void) {
  const a = hosted();
  let value = 0;
  const target = createTarget({ get: () => value, set: (v: number) => { value = v; } });
  const hold = a.animator.hold({ target, value: 70 });
  a.tick(0);
  const spring = a.animator.spring({ target, to: 50 }) as PhysicsHandle<number>;
  const tween = a.animator.tween({ target, from: 30, to: 0, ms: 100, easing: 'linear' });
  a.tick(1);
  a.tick(51);
  tween.cancel();
  expect(stateOf(target).beside).not.toBeNull();
  redirect(a, spring, target);
  hold.release({ commit: false });
  for (let t = 60; t < 10_000; t += 16) a.tick(t);
  return value;
}

describe("a target spring's setTarget", () => {
  it('comes to rest where a fresh spring toward the same value does', () => {
    const redirected = springUnderHold((_a, spring) => spring.setTarget(20));
    const fresh = springUnderHold((a, spring, target) => { spring.cancel(); a.animator.spring({ target, to: 20 }); });
    expect(fresh).toBeCloseTo(20, 1);
    expect(redirected).toBeCloseTo(fresh, 1);
  });
});
