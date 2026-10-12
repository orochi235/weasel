import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { useAnimator } from './useAnimator';
import { createTarget, type Target } from './target';
import type { AnimatorEvent } from './types';

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
    pending: () => callbacks.size,
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

describe('a hold on a target', () => {
  it('stands in for the committed value, which it leaves alone', () => {
    const { animator, step } = setup();
    const b = box(10);
    act(() => { animator.hold({ target: b.target, value: 70 }); });
    expect(b.target.read()).toBeCloseTo(70, 9);
    expect(b.target.active).toBe(true);
    step(16);
    expect(b.shown.at(-1)).toBeCloseTo(70, 9);
    expect(b.committed).toBe(10);
  });

  it('covers the move a tween makes in the committed value', () => {
    const { animator, step } = setup();
    const b = box(10);
    act(() => { animator.hold({ target: b.target, value: 70 }); });
    step(0);
    act(() => { animator.tween({ target: b.target, to: 50, ms: 1000, easing: linear }); });
    expect(b.committed).toBe(50);
    expect(b.target.read()).toBeCloseTo(70, 9);
    step(0);
    step(500);
    expect(b.shown.at(-1)).toBeCloseTo(70, 6);
    step(500);
    expect(b.shown.at(-1)).toBeCloseTo(70, 6);
  });

  it('shows the share of a tween its weight leaves, with no jump as the tween starts', () => {
    const { animator, step } = setup();
    const b = box(10);
    act(() => { animator.hold({ target: b.target, value: 70, weight: 0.5 }); });
    step(0);
    expect(b.target.read()).toBeCloseTo(40, 9);
    act(() => { animator.tween({ target: b.target, to: 50, ms: 1000, easing: linear }); });
    expect(b.target.read()).toBeCloseTo(40, 9);
    step(0);
    step(500);
    expect(b.shown.at(-1)).toBeCloseTo(50, 6);
    const out = [0];
    b.target.readInto(out);
    expect(out[0]).toBeCloseTo(50, 6);
    step(500);
    expect(b.shown.at(-1)).toBeCloseTo(60, 6);
  });

  it('covers a spring toward a destination, and carries one pushed where it stands', () => {
    const { animator, step } = setup();
    const b = box(10);
    const c = box(10);
    act(() => {
      animator.hold({ target: b.target, value: 70 });
      animator.hold({ target: c.target, value: 70 });
    });
    step(0);
    act(() => {
      animator.spring({ target: b.target, to: 50 });
      animator.spring({ target: c.target, to: 10, velocity: 500 });
    });
    expect(b.target.read()).toBeCloseTo(70, 9);
    step(0);
    step(100);
    expect(b.shown.at(-1)).toBeCloseTo(70, 6);
    expect(c.shown.at(-1)).toBeGreaterThan(75);
  });

  it('does not move the value on screen as a spring under it loses its destination', () => {
    const { animator, step } = setup();
    const b = box(10);
    act(() => { animator.hold({ target: b.target, value: 70, weight: 0.5 }); });
    step(0);
    let spring!: ReturnType<typeof animator.physics<number>>;
    act(() => { spring = animator.physics({ target: b.target, to: 50 }); });
    step(0);
    step(100);
    const was = b.target.read();
    expect(was).toBeGreaterThan(41);
    act(() => { spring.setTarget(null); });
    expect(b.target.read()).toBeCloseTo(was, 6);
    // The committed value stopped where the spring had brought it, which the hold shows half of.
    expect(b.committed).toBeCloseTo(2 * was - 70, 6);
    step(16);
    expect(Math.abs(b.shown.at(-1)! - was)).toBeLessThan(5);
  });

  it('carries a coast, which has no destination, on top of it', () => {
    const { animator, step } = setup();
    const b = box(10);
    act(() => { animator.hold({ target: b.target, value: 70 }); });
    step(0);
    act(() => { animator.decay({ target: b.target, velocity: 1000, friction: 0.001 }); });
    step(0);
    step(100);
    expect(b.shown.at(-1)).toBeGreaterThan(75);
    expect(b.committed).toBe(10);
  });

  it('covers a tween only on the axes it holds', () => {
    const { animator, step } = setup();
    let committed = [10, 10];
    const target = createTarget<number[]>({ get: () => committed, set: (v) => { committed = v; } });
    act(() => { animator.hold({ target, value: [70, 70], axes: [0] }); });
    step(0);
    act(() => { animator.tween({ target, to: [50, 50], ms: 1000, easing: linear }); });
    step(0);
    step(500);
    expect(target.read()[0]).toBeCloseTo(70, 6);
    expect(target.read()[1]).toBeCloseTo(30, 6);
  });

  it('carries a tween from a value away from the committed one on top of it', () => {
    const { animator, step } = setup();
    const b = box(10);
    act(() => { animator.hold({ target: b.target, value: 70 }); });
    step(0);
    act(() => { animator.tween({ target: b.target, from: 30, to: 10, ms: 1000, easing: linear }); });
    expect(b.target.read()).toBeCloseTo(90, 9);
    step(0);
    step(500);
    expect(b.shown.at(-1)).toBeCloseTo(80, 6);
    step(500);
    expect(b.shown.at(-1)).toBeCloseTo(70, 6);
  });

  it('does not move when the committed value changes under it', () => {
    const { animator, step } = setup();
    const b = box(10);
    act(() => { animator.hold({ target: b.target, value: 70 }); });
    step(16);
    b.committed = 500;
    // A hold of plain values asks for no frames, so the reader has to see the change itself.
    expect(b.target.read()).toBeCloseTo(70, 9);
  });

  it('shows a committed value that changed under a hold at a weight below 1', () => {
    const { animator, step } = setup();
    const b = box(10);
    act(() => { animator.hold({ target: b.target, value: 70, weight: 0.5 }); });
    step(16);
    b.committed = 110;
    expect(b.target.read()).toBeCloseTo(90, 9);
  });

  it('shows the lerp of two holds at weights w and 1 - w', () => {
    const { animator, step } = setup();
    const b = box(10);
    act(() => {
      animator.hold({ target: b.target, value: 100, weight: 0.25 });
      animator.hold({ target: b.target, value: 200, weight: 0.75 });
    });
    expect(b.target.read()).toBeCloseTo(175, 9);
    step(16);
    expect(b.shown.at(-1)).toBeCloseTo(175, 9);
  });

  it('pulls toward the committed value at a weight below 1', () => {
    const { animator, step } = setup();
    const b = box(10);
    act(() => { animator.hold({ target: b.target, value: 110, weight: 0.25 }); });
    step(16);
    expect(b.shown.at(-1)).toBeCloseTo(35, 9);
  });

  it('reads a function value and a function weight each frame', () => {
    const { animator, step } = setup();
    const b = box(0);
    let v = 40;
    let w = 1;
    act(() => { animator.hold({ target: b.target, value: () => v, weight: () => w }); });
    step(16);
    expect(b.shown.at(-1)).toBeCloseTo(40, 9);
    v = 60;
    step(16);
    expect(b.shown.at(-1)).toBeCloseTo(60, 9);
    w = 0.5;
    step(16);
    expect(b.shown.at(-1)).toBeCloseTo(30, 9);
    act(() => { animator.pause(); });
    v = 100;
    step(16);
    expect(b.shown.at(-1)).toBeCloseTo(50, 9);
  });

  it('keeps the frame loop running only while a value or weight is a function', () => {
    const { animator, step, clock } = setup();
    const b = box(0);
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target: b.target, value: 40 }); });
    expect(clock.pending()).toBe(1);
    step(16);
    expect(b.shown).toEqual([40, 40]);
    expect(clock.pending()).toBe(0);
    expect(animator.isActive()).toBe(true);
    act(() => { h.cancel(); });
    step(16);
    expect(b.shown).toEqual([40, 40, 40]);
    expect(clock.pending()).toBe(0);

    const c = box(0);
    act(() => { animator.hold({ target: c.target, value: () => 5 }); });
    step(16);
    step(16);
    expect(clock.pending()).toBe(1);
  });

  it('touch() shows a value that changed outside a frame, and runs one', () => {
    const { animator, step, clock } = setup();
    const b = box(0);
    const at = { v: 40 };
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target: b.target, value: () => at.v, weight: 1 }); });
    step(16);
    at.v = 90;
    expect(b.target.read()).toBeCloseTo(40, 9);
    act(() => { h.touch(); });
    expect(b.target.read()).toBeCloseTo(90, 9);
    expect(clock.pending()).toBe(1);
  });

  it('commits what it was showing when canceled, so the target stays there', () => {
    const { animator, step } = setup();
    const b = box(10);
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target: b.target, value: 110, weight: 0.25 }); });
    step(16);
    act(() => { h.cancel(); });
    expect(b.committed).toBeCloseTo(35, 9);
    expect(b.target.read()).toBeCloseTo(35, 9);
    expect(b.target.active).toBe(false);
    step(16);
    expect(b.shown.at(-1)).toBeCloseTo(35, 9);
  });

  it('commits on release, and with commit: false falls back to the committed value', () => {
    const { animator, step } = setup();
    const b = box(10);
    const c = box(10);
    let hb!: ReturnType<typeof animator.hold>;
    let hc!: ReturnType<typeof animator.hold>;
    act(() => {
      hb = animator.hold({ target: b.target, value: 70 });
      hc = animator.hold({ target: c.target, value: 70 });
    });
    step(16);
    act(() => { hb.release(); hc.release({ commit: false }); });
    expect(b.committed).toBe(70);
    expect(c.committed).toBe(10);
    expect(c.target.read()).toBe(10);
    step(16);
    expect(b.shown.at(-1)).toBe(70);
    expect(c.shown.at(-1)).toBe(10);
    expect(animator.isActive()).toBe(false);
  });

  it('leaves the value on screen where it was when one of two holds is released', () => {
    const { animator, step } = setup();
    const b = box(10);
    let h!: ReturnType<typeof animator.hold>;
    act(() => {
      h = animator.hold({ target: b.target, value: 100, weight: 0.25 });
      animator.hold({ target: b.target, value: 200, weight: 0.5 });
    });
    step(16);
    // 10 + 0.25 * 90 + 0.5 * 190
    expect(b.shown.at(-1)).toBeCloseTo(127.5, 9);
    act(() => { h.release(); });
    expect(b.target.read()).toBeCloseTo(127.5, 9);
    step(16);
    expect(b.shown.at(-1)).toBeCloseTo(127.5, 9);
  });

  it('leaves an offset tween running when it is released', () => {
    const { animator, step } = setup();
    const b = box(10);
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target: b.target, value: 70 }); });
    step(0);
    act(() => { animator.tween({ target: b.target, from: 30, to: 10, ms: 1000, easing: linear }); });
    step(0);
    step(500);
    act(() => { h.release(); });
    expect(b.target.read()).toBeCloseTo(80, 6);
    step(250);
    expect(b.shown.at(-1)).toBeCloseTo(75, 6);
    step(250);
    expect(b.shown.at(-1)).toBeCloseTo(70, 6);
    expect(b.committed).toBeCloseTo(70, 6);
  });

  it('takes the share of a tween it covered with it when it is released', () => {
    const { animator, step } = setup();
    const b = box(10);
    const c = box(10);
    let hb!: ReturnType<typeof animator.hold>;
    let hc!: ReturnType<typeof animator.hold>;
    act(() => {
      hb = animator.hold({ target: b.target, value: 70 });
      hc = animator.hold({ target: c.target, value: 70, weight: 0.5 });
    });
    step(0);
    act(() => {
      animator.tween({ target: b.target, to: 50, ms: 1000, easing: linear });
      animator.tween({ target: c.target, to: 50, ms: 1000, easing: linear });
    });
    step(0);
    step(500);
    act(() => { hb.release(); hc.release(); });
    // The full hold showed none of the tween, so none of it is left; the half hold showed half.
    expect(b.target.read()).toBeCloseTo(70, 6);
    expect(c.target.read()).toBeCloseTo(50, 6);
    step(250);
    expect(b.shown.at(-1)).toBeCloseTo(70, 6);
    expect(c.shown.at(-1)).toBeCloseTo(55, 6);
    step(250);
    step(16);
    expect(b.shown.at(-1)).toBeCloseTo(70, 6);
    expect(c.shown.at(-1)).toBeCloseTo(60, 6);
    expect(b.committed).toBeCloseTo(70, 6);
    expect(c.committed).toBeCloseTo(60, 6);
  });

  it('commits a tween canceled after such a release where it was showing', () => {
    const { animator, step } = setup();
    const b = box(10);
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target: b.target, value: 70, weight: 0.5 }); });
    step(0);
    let tw!: ReturnType<typeof animator.tween>;
    act(() => { tw = animator.tween({ target: b.target, to: 50, ms: 1000, easing: linear }); });
    step(0);
    step(500);
    act(() => { h.release(); });
    step(250);
    act(() => { tw.cancel(); });
    expect(b.committed).toBeCloseTo(55, 6);
    expect(b.target.read()).toBeCloseTo(55, 6);
    expect(b.target.active).toBe(false);
  });

  it('shows a tween where it is when released without committing', () => {
    const { animator, step } = setup();
    const b = box(10);
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target: b.target, value: 70 }); });
    step(0);
    act(() => { animator.tween({ target: b.target, to: 50, ms: 1000, easing: linear }); });
    step(0);
    step(500);
    act(() => { h.release({ commit: false }); });
    expect(b.target.read()).toBeCloseTo(30, 6);
    step(500);
    expect(b.shown.at(-1)).toBeCloseTo(50, 6);
  });

  it('commits a tween canceled under it where the tween was, behind the hold', () => {
    const { animator, step } = setup();
    const b = box(10);
    const c = box(10);
    act(() => {
      animator.hold({ target: b.target, value: 70 });
      animator.hold({ target: c.target, value: 70, weight: 0.5 });
    });
    step(0);
    let tb!: ReturnType<typeof animator.tween>;
    let tc!: ReturnType<typeof animator.tween>;
    act(() => {
      tb = animator.tween({ target: b.target, to: 50, ms: 1000, easing: linear });
      tc = animator.tween({ target: c.target, to: 50, ms: 1000, easing: linear });
    });
    step(0);
    step(500);
    act(() => { tb.cancel(); tc.cancel(); });
    expect(b.committed).toBeCloseTo(30, 6);
    expect(b.target.read()).toBeCloseTo(70, 6);
    expect(c.committed).toBeCloseTo(30, 6);
    expect(c.target.read()).toBeCloseTo(50, 6);
  });

  it('reads right between frames as animations on the target start and stop around a touch', () => {
    const { animator, step } = setup();
    const b = box(0);
    let v = 50;
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target: b.target, value: () => v }); });
    step(16);
    let tw!: ReturnType<typeof animator.tween>;
    act(() => {
      tw = animator.tween({ target: b.target, from: 8, to: 0, ms: 1000, easing: linear });
      animator.spring({ target: b.target, from: 4, to: 0 });
    });
    expect(b.target.read()).toBeCloseTo(62, 9);
    v = 60;
    act(() => { h.touch(); });
    expect(b.target.read()).toBeCloseTo(72, 9);
    act(() => { tw.cancel(); });
    v = 70;
    act(() => { h.touch(); });
    // The canceled tween's 8 stays on screen beside the hold, which stands in front of a commit.
    expect(b.target.read()).toBeCloseTo(82, 9);
    step(0);
    expect(b.shown.at(-1)).toBeCloseTo(82, 6);
  });

  /** A hold of 70 over a committed 10, with a tween canceled halfway through its 20 of travel. */
  function canceledUnderHold() {
    const s = setup();
    const b = box(10);
    let h!: ReturnType<typeof s.animator.hold>;
    act(() => { h = s.animator.hold({ target: b.target, value: 70 }); });
    s.step(0);
    let tw!: ReturnType<typeof s.animator.tween>;
    act(() => { tw = s.animator.tween({ target: b.target, from: 30, to: 10, ms: 1000, easing: linear }); });
    s.step(0);
    s.step(500);
    expect(b.target.read()).toBeCloseTo(80, 6);
    act(() => { tw.cancel(); });
    return { ...s, b, h };
  }

  it('keeps an offset canceled under it on screen, and commits it when the hold is released', () => {
    const { b, h, step } = canceledUnderHold();
    expect(b.target.read()).toBeCloseTo(80, 6);
    expect(b.committed).toBe(10);
    step(16);
    expect(b.shown.at(-1)).toBeCloseTo(80, 6);
    act(() => { h.release(); });
    expect(b.committed).toBeCloseTo(80, 6);
    expect(b.target.read()).toBeCloseTo(80, 6);
    expect(b.target.active).toBe(false);
  });

  it('commits a canceled offset where the hold is released without committing itself', () => {
    const { b, h } = canceledUnderHold();
    act(() => { h.release({ commit: false }); });
    expect(b.committed).toBeCloseTo(20, 6);
    expect(b.target.read()).toBeCloseTo(20, 6);
  });

  it('drops a canceled offset when the target is stopped without committing', () => {
    const { b } = canceledUnderHold();
    act(() => { b.target.stop({ commit: false }); });
    expect(b.committed).toBe(10);
    expect(b.target.read()).toBe(10);
  });

  it('hands what a canceled offset left under it to the next animation with a destination', () => {
    const { b, h, animator, step } = canceledUnderHold();
    act(() => { animator.tween({ target: b.target, to: 50, ms: 1000, easing: linear }); });
    // It travels from 20, the committed 10 and the 10 left beside it, to 50. The hold covers
    // the move from 10 to 50, and the 10 stays on top until the tween has brought it in.
    expect(b.target.read()).toBeCloseTo(80, 6);
    step(0);
    step(500);
    expect(b.shown.at(-1)).toBeCloseTo(75, 6);
    step(500);
    step(16);
    expect(b.shown.at(-1)).toBeCloseTo(70, 6);
    act(() => { h.release({ commit: false }); });
    expect(b.committed).toBe(50);
    expect(b.target.read()).toBe(50);
  });

  it('is on the table as a hold, and obeys cancelKey and cancelAll', () => {
    const { animator } = setup();
    const b = box(10);
    const events: AnimatorEvent[] = [];
    animator.watch((e) => events.push(e));
    act(() => { animator.hold({ target: b.target, value: 70, cancelKey: 'drag', label: 'preview' }); });
    expect(animator.live().map((a) => [a.kind, a.key, a.label])).toEqual([['hold', 'drag', 'preview']]);
    act(() => { animator.hold({ target: b.target, value: 90, cancelKey: 'drag' }); });
    expect(events.map((e) => e.type)).toEqual(['start', 'interrupt', 'start']);
    expect(b.committed).toBe(70);
    expect(b.target.read()).toBeCloseTo(90, 9);
    act(() => { animator.cancelAll(); });
    expect(b.committed).toBe(90);
    expect(animator.isActive()).toBe(false);
  });

  it('registers under a key without canceling its holders when interrupt is false', () => {
    const { animator } = setup();
    const b = box(0);
    act(() => {
      animator.hold({ target: b.target, value: 100, weight: 0.5, cancelKey: 'k' });
      animator.hold({ target: b.target, value: 200, weight: 0.5, cancelKey: 'k', interrupt: false });
    });
    expect(animator.live()).toHaveLength(2);
    expect(b.target.read()).toBeCloseTo(150, 9);
    act(() => { animator.cancelKey('k'); });
    expect(animator.live()).toHaveLength(0);
    expect(b.target.read()).toBeCloseTo(150, 9);
  });

  it('takes the short way round on an angle axis', () => {
    const { animator, step } = setup();
    let committed = 0.1;
    const shown: number[] = [];
    const target = createTarget<number>({
      get: () => committed,
      set: (v) => { committed = v; },
      show: (v) => { shown.push(v); },
      axes: { count: 1, to: (v) => [v], from: (a) => a[0]!, angles: [0] },
    });
    act(() => { animator.hold({ target, value: Math.PI * 2 - 0.1, weight: 0.5 }); });
    step(16);
    expect(shown.at(-1)).toBeCloseTo(0, 9);
  });
});
