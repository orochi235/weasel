import { describe, expect, it, vi } from 'vitest';
import { createHostedAnimator } from '../createHostedAnimator';
import { createTarget, stateOf } from '../target';
import { createTargetTable } from '../targetTable';

/** An animator on frames the test runs. */
function hosted() {
  let now = 0;
  const h = createHostedAnimator({ now: () => now, requestFrame: () => {} });
  return { animator: h.animator, tick: (t: number) => { now = t; h.tick(t); } };
}

/** A number target whose setter throws while `bad` is set. */
function numberTarget() {
  let value = 0;
  const box = { bad: false };
  const target = createTarget({
    get: () => value,
    set: (v: number) => { if (box.bad) throw new Error('bad set'); value = v; },
  });
  return { target, box };
}

/** A target held by `a`, a tween under the hold canceled halfway, so its rest waits beside. */
function withBeside(a: ReturnType<typeof hosted>) {
  const { target, box } = numberTarget();
  a.animator.hold({ target, value: 70 });
  a.tick(0);
  const tween = a.animator.tween({ target, from: 30, to: 0, ms: 100, easing: 'linear' });
  a.tick(1);
  a.tick(51);
  tween.cancel();
  expect(stateOf(target).beside).not.toBeNull();
  return { target, box, beside: stateOf(target).beside!.slice() };
}

describe('a start refused as it starts', () => {
  it('leaves another animator\'s target and what waits beside it alone', () => {
    const a = hosted();
    const b = hosted();
    const { target, beside } = withBeside(a);
    expect(() => b.animator.tween({ target, to: 5, ms: 100 })).toThrow(/another animator/);
    expect(() => b.animator.spring({ target, to: 5 })).toThrow(/another animator/);
    expect(stateOf(target).beside).toEqual(beside);
  });

  it('refuses another animator\'s target before it interrupts what holds its key', () => {
    const a = hosted();
    const b = hosted();
    const { target } = withBeside(a);
    const other = numberTarget().target;
    b.animator.tween({ target: other, to: 10, ms: 100, cancelKey: 'k' });
    expect(() => b.animator.tween({ target, to: 5, ms: 100, cancelKey: 'k' })).toThrow(/another animator/);
    expect(() => b.animator.hold({ target, value: 5, cancelKey: 'k' })).toThrow(/another animator/);
    expect(b.animator.live()).toHaveLength(1);
  });

  it('keeps what waits beside the committed value when the setter throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = hosted();
    const { target, box, beside } = withBeside(a);
    box.bad = true;
    expect(() => a.animator.tween({ target, to: 5, ms: 100 })).toThrow('bad set');
    expect(() => a.animator.spring({ target, to: 5 })).toThrow('bad set');
    expect(stateOf(target).beside).toEqual(beside);
    vi.restoreAllMocks();
  });
});

describe('a target tween whose path throws as it starts', () => {
  it('throws to the caller and leaves the target at rest where it was', () => {
    const a = hosted();
    const { target } = numberTarget();
    const other = hosted();
    expect(() => a.animator.tween({
      target, to: 10, ms: 100, interpolator: () => () => { throw new Error('bad path'); },
    })).toThrow('bad path');
    expect(() => a.animator.tween({
      target, to: 10, ms: 100, interpolate: (x, y, u) => x + (y - x) * u, easing: () => { throw new Error('bad easing'); },
    })).toThrow('bad easing');
    expect(target.committed()).toBe(0);
    expect(target.active).toBe(false);
    expect(stateOf(target).behind).toHaveLength(0);
    // No longer this animator's, so another may move it.
    expect(() => other.animator.tween({ target, to: 5, ms: 100 })).not.toThrow();
  });
});

describe('a hold refused for its own input', () => {
  it('leaves what holds its key holding', () => {
    const a = hosted();
    const { target } = numberTarget();
    a.animator.hold({ target, value: 5, cancelKey: 'k' });
    expect(() => a.animator.hold({ target, value: 5, axes: ['nope'] as never, cancelKey: 'k' })).toThrow();
    expect(() => a.animator.hold({ target, value: { x: 1 } as never, cancelKey: 'k' })).toThrow();
    expect(() => a.animator.hold({ target, value: () => [1, 2] as never, cancelKey: 'k' })).toThrow();
    expect(a.animator.live()).toHaveLength(1);
    expect(target.read()).toBe(5);
  });

  it('leaves what holds its key holding when its rows hold axes the table lacks', () => {
    const a = hosted();
    const table = createTargetTable({ axes: 2 });
    table.add([0, 0]);
    a.animator.holdRows({ table, cancelKey: 'k' });
    expect(() => a.animator.holdRows({ table, axes: [5], cancelKey: 'k' })).toThrow();
    expect(a.animator.live()).toHaveLength(1);
  });
});

describe('an animation on a target whose setter throws as it is canceled', () => {
  it('still leaves the target to whatever else moves it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = hosted();
    const other = hosted();
    const { target, box } = numberTarget();
    a.tick(0);
    const handles = [
      a.animator.tween({ target, to: 10, ms: 100 }),
      a.animator.spring({ target, to: 20 }),
      a.animator.hold({ target, value: 5 }),
    ];
    a.tick(20);
    box.bad = true;
    for (const h of handles) expect(() => h.cancel()).toThrow('bad set');
    box.bad = false;
    expect(target.active).toBe(false);
    expect(() => other.animator.tween({ target, to: 5, ms: 100 })).not.toThrow();
    vi.restoreAllMocks();
  });
});
