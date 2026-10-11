import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { useAnimator } from './useAnimator';
import { createTarget, type Target } from './target';

function makeClock() {
  let now = 0;
  const callbacks = new Map<number, (t: number) => void>();
  let nextHandle = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void): number => {
      const h = nextHandle++;
      callbacks.set(h, cb);
      return h;
    },
    cancelFrame: (h: number): void => { callbacks.delete(h); },
    advance: (deltaMs: number) => {
      now += deltaMs;
      const due = Array.from(callbacks.values());
      callbacks.clear();
      for (const cb of due) cb(now);
    },
  };
}

/** A number the test owns, its target, and every value `show` was handed. */
function box(start = 0) {
  const b = { committed: start, shown: [] as number[], target: null as unknown as Target<number> };
  b.target = createTarget<number>({
    get: () => b.committed,
    set: (v) => { b.committed = v; },
    show: (v) => { b.shown.push(v); },
  });
  return b;
}

function setup() {
  const clock = makeClock();
  const { result, unmount } = renderHook(() => useAnimator(clock));
  return { clock, animator: result.current, unmount, step: (ms: number) => act(() => clock.advance(ms)) };
}

describe('a tween on a target', () => {
  it('commits its destination as it starts and leaves the value on screen where it was', () => {
    const { animator } = setup();
    const b = box(0);
    act(() => { animator.tween({ target: b.target, to: 100, ms: 1000, easing: linear }); });
    expect(b.committed).toBe(100);
    expect(b.target.read()).toBeCloseTo(0, 9);
    expect(b.target.active).toBe(true);
  });

  it('shows what it has traveled each frame and comes to rest on its destination', () => {
    const { animator, step } = setup();
    const b = box(0);
    let done = 0;
    act(() => { animator.tween({ target: b.target, to: 100, ms: 1000, easing: linear, onDone: () => { done += 1; } }); });
    step(0);
    step(250);
    expect(b.shown.at(-1)).toBeCloseTo(25, 6);
    expect(b.target.read()).toBeCloseTo(25, 6);
    step(750);
    expect(b.shown.at(-1)).toBe(100);
    expect(b.target.read()).toBe(100);
    expect(b.target.active).toBe(false);
    expect(done).toBe(1);
  });

  it('adds to another tween on the same target, and neither cancels the other', () => {
    const { animator, step } = setup();
    const b = box(0);
    act(() => { animator.tween({ target: b.target, to: 100, ms: 1000, easing: linear }); });
    step(0);
    step(500);
    expect(b.target.read()).toBeCloseTo(50, 6);
    act(() => { animator.tween({ target: b.target, to: 40, ms: 1000, easing: linear }); });
    // The second starts from the committed 100, so the value on screen has not moved.
    expect(b.committed).toBe(40);
    expect(b.target.read()).toBeCloseTo(50, 6);
    step(250);
    // 40, plus the first's 25 left of its 100, plus the second's 45 left of its 60.
    expect(b.target.read()).toBeCloseTo(40 - 25 + 45, 6);
    expect(animator.live()).toHaveLength(2);
    step(1000);
    expect(b.target.read()).toBe(40);
  });

  it('moves the value on screen to an explicit from', () => {
    const { animator, step } = setup();
    const b = box(10);
    act(() => { animator.tween({ target: b.target, from: 50, to: 100, ms: 1000, easing: linear }); });
    expect(b.target.read()).toBeCloseTo(50, 9);
    step(0);
    step(500);
    expect(b.target.read()).toBeCloseTo(75, 6);
  });

  it('tells onTick its own value, apart from anything else on the target', () => {
    const { animator, step } = setup();
    const b = box(0);
    const own: number[] = [];
    act(() => {
      animator.tween({ target: b.target, to: 100, ms: 1000, easing: linear });
      animator.tween({ target: b.target, to: 40, ms: 1000, easing: linear, onTick: (v) => own.push(v) });
    });
    step(0);
    step(500);
    expect(own.at(-1)).toBeCloseTo(70, 6);
    expect(b.target.read()).toBeCloseTo(40 - 50 + 30, 6);
  });

  it("follows the caller's path where it is given one", () => {
    const { animator, step } = setup();
    const b = box(0);
    act(() => {
      animator.tween({
        target: b.target, to: 100, ms: 1000, easing: linear,
        interpolate: (from, to, u) => from + (to - from) * u * u,
      });
    });
    expect(b.target.read()).toBeCloseTo(0, 9);
    step(0);
    step(500);
    expect(b.target.read()).toBeCloseTo(25, 6);
    step(500);
    expect(b.target.read()).toBe(100);
  });

  it('commits where it was when canceled, so the value on screen stays', () => {
    const { animator, step } = setup();
    const b = box(0);
    let done = 0;
    let handle!: ReturnType<typeof animator.tween>;
    act(() => { handle = animator.tween({ target: b.target, to: 100, ms: 1000, easing: linear, onDone: () => { done += 1; } }); });
    step(0);
    step(300);
    act(() => handle.cancel());
    expect(b.committed).toBeCloseTo(30, 6);
    expect(b.target.read()).toBeCloseTo(30, 6);
    expect(b.target.active).toBe(false);
    step(1000);
    expect(b.committed).toBeCloseTo(30, 6);
    expect(done).toBe(0);
  });

  it('canceling one of two leaves the other running and the value on screen unmoved', () => {
    const { animator, step } = setup();
    const b = box(0);
    let first!: ReturnType<typeof animator.tween>;
    act(() => {
      first = animator.tween({ target: b.target, to: 100, ms: 1000, easing: linear });
      animator.tween({ target: b.target, to: 40, ms: 1000, easing: linear });
    });
    step(0);
    step(500);
    const before = b.target.read();
    act(() => first.cancel());
    expect(b.target.read()).toBeCloseTo(before, 6);
    step(500);
    // The first stopped halfway through its 100; the second's own travel of -60 finished.
    expect(b.target.read()).toBeCloseTo(-10, 6);
    expect(b.committed).toBeCloseTo(-10, 6);
  });

  it('commits where each animation was when the animator unmounts', () => {
    const { animator, step, unmount } = setup();
    const b = box(0);
    act(() => { animator.tween({ target: b.target, to: 100, ms: 1000, easing: linear }); });
    step(0);
    step(400);
    unmount();
    expect(b.committed).toBeCloseTo(40, 6);
    expect(b.target.active).toBe(false);
  });

  it('holds while paused, on its own handle and on the animator', () => {
    const { animator, step } = setup();
    const b = box(0);
    let handle!: ReturnType<typeof animator.tween>;
    act(() => { handle = animator.tween({ target: b.target, to: 100, ms: 1000, easing: linear }); });
    step(0);
    step(200);
    act(() => handle.pause());
    step(300);
    expect(b.target.read()).toBeCloseTo(20, 6);
    act(() => { handle.resume(); animator.pause(); });
    step(300);
    expect(b.target.read()).toBeCloseTo(20, 6);
    act(() => animator.resume());
    step(300);
    expect(b.target.read()).toBeCloseTo(50, 6);
  });

  it('takes the short way round on an angle axis', () => {
    const { animator, step } = setup();
    let committed = 0.1;
    const target = createTarget<number>({
      get: () => committed,
      set: (v) => { committed = v; },
      axes: { count: 1, to: (v) => [v], from: (a) => a[0]!, angles: [0] },
    });
    const to = Math.PI * 2 - 0.1;
    act(() => { animator.tween({ target, to, ms: 1000, easing: linear }); });
    step(0);
    step(500);
    // Halfway from 0.1 down through 0 to -0.1, which is `to` less a full turn.
    expect(target.read()).toBeCloseTo(to + 0.1, 6);
  });

  it('refuses a value that is not the shape of the target', () => {
    const { animator } = setup();
    let committed = { x: 0, y: 0 };
    const target = createTarget({ get: () => committed, set: (v) => { committed = v; } });
    expect(() => animator.tween({ target, to: { x: 1 } as never, ms: 100 })).toThrow("`to` is not the target's shape");
    expect(target.active).toBe(false);
    expect(committed).toEqual({ x: 0, y: 0 });
  });

  it('moves a target of several axes', () => {
    const { animator, step } = setup();
    let committed = { x: 0, y: 10 };
    const target = createTarget({ get: () => committed, set: (v) => { committed = v; } });
    act(() => { animator.tween({ target, to: { x: 100, y: 0 }, ms: 1000, easing: linear }); });
    step(0);
    step(500);
    const v = target.read();
    expect(v.x).toBeCloseTo(50, 6);
    expect(v.y).toBeCloseTo(5, 6);
  });
});

describe('a cancelKey on a target', () => {
  it('interrupts the animation holding it, without moving the value on screen', () => {
    const { animator, step } = setup();
    const b = box(0);
    act(() => { animator.tween({ target: b.target, to: 100, ms: 1000, easing: linear, cancelKey: 'k' }); });
    step(0);
    step(500);
    act(() => { animator.tween({ target: b.target, to: 0, ms: 1000, easing: linear, cancelKey: 'k' }); });
    expect(animator.live()).toHaveLength(1);
    expect(b.committed).toBe(0);
    expect(b.target.read()).toBeCloseTo(50, 6);
    step(500);
    expect(b.target.read()).toBeCloseTo(25, 6);
  });

  it('starts a spring at the velocity of the animation it interrupts', () => {
    const { animator, step } = setup();
    const b = box(0);
    act(() => { animator.tween({ target: b.target, to: 100, ms: 1000, easing: linear, cancelKey: 'k' }); });
    step(0);
    step(500);
    act(() => { animator.spring({ target: b.target, to: 50, cancelKey: 'k' }); });
    expect(b.target.read()).toBeCloseTo(50, 6);
    step(16);
    // It arrived at its destination moving at 100 a second, so it runs past it first.
    expect(b.target.read()).toBeGreaterThan(50.5);
  });

  it('starts a spring from a standstill where it is given a velocity of its own', () => {
    const { animator, step } = setup();
    const b = box(0);
    act(() => { animator.tween({ target: b.target, to: 100, ms: 1000, easing: linear, cancelKey: 'k' }); });
    step(0);
    step(500);
    act(() => { animator.spring({ target: b.target, to: 50, velocity: 0, cancelKey: 'k' }); });
    step(16);
    expect(b.target.read()).toBeCloseTo(50, 6);
  });
});

describe('a spring on a target', () => {
  it('settles on its destination and reports done once', () => {
    const { animator, step } = setup();
    const b = box(0);
    let done = 0;
    act(() => { animator.spring({ target: b.target, to: 100, onDone: () => { done += 1; } }); });
    expect(b.committed).toBe(100);
    step(0);
    step(100);
    expect(b.target.read()).toBeGreaterThan(0);
    expect(b.target.read()).toBeLessThan(100);
    for (let i = 0; i < 200; i++) step(16);
    expect(b.target.read()).toBe(100);
    expect(b.target.active).toBe(false);
    expect(done).toBe(1);
  });

  it('retargets without moving the value on screen, keeping its velocity', () => {
    const { animator, step } = setup();
    const b = box(0);
    let handle!: ReturnType<typeof animator.physics<number>>;
    act(() => { handle = animator.physics<number>({ target: b.target, to: 100 }); });
    step(0);
    step(100);
    const before = b.target.read();
    act(() => handle.setTarget(-100));
    expect(b.committed).toBe(-100);
    expect(b.target.read()).toBeCloseTo(before, 6);
    step(8);
    // Still carried forward by the speed it had toward 100.
    expect(b.target.read()).toBeGreaterThan(before);
    for (let i = 0; i < 300; i++) step(16);
    expect(b.target.read()).toBe(-100);
  });

  it('coasts from where it is when its target is cleared, and commits where it stops', () => {
    const { animator, step } = setup();
    const b = box(0);
    let handle!: ReturnType<typeof animator.physics<number>>;
    act(() => { handle = animator.physics<number>({ target: b.target, to: 100 }); });
    step(0);
    step(100);
    const before = b.target.read();
    act(() => handle.setTarget(null));
    expect(b.target.read()).toBeCloseTo(before, 6);
    for (let i = 0; i < 400; i++) step(16);
    expect(b.target.active).toBe(false);
    expect(b.committed).toBeGreaterThan(before);
    expect(b.committed).toBeLessThan(100);
    expect(b.target.read()).toBe(b.committed);
  });

  it('refuses constants a closed form cannot solve', () => {
    const { animator } = setup();
    const b = box(0);
    expect(() => animator.spring({ target: b.target, to: 1, damping: 0 })).toThrow('positive damping and mass');
    expect(b.committed).toBe(0);
  });
});

describe('a decay on a target', () => {
  it('leaves the committed value alone while it coasts and commits where it stops', () => {
    const { animator, step } = setup();
    const b = box(10);
    let done = 0;
    act(() => { animator.decay({ target: b.target, velocity: 1000, friction: 0.001, onDone: () => { done += 1; } }); });
    step(0);
    step(100);
    expect(b.committed).toBe(10);
    expect(b.target.read()).toBeGreaterThan(10);
    for (let i = 0; i < 400; i++) step(16);
    expect(done).toBe(1);
    expect(b.target.active).toBe(false);
    // v0 over the friction's rate, less the little it had left at the threshold.
    expect(b.committed).toBeCloseTo(10 + 1000 / -Math.log(0.001), 0);
    expect(b.target.read()).toBe(b.committed);
  });
});

describe('two animators and one target', () => {
  it('refuses the second while the first is moving it', () => {
    const a = setup();
    const other = setup();
    const b = box(0);
    act(() => { a.animator.tween({ target: b.target, to: 100, ms: 1000 }); });
    expect(() => other.animator.tween({ target: b.target, to: 5, ms: 1000 })).toThrow('another animator');
    expect(b.committed).toBe(100);
  });
});
