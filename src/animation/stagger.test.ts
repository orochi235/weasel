import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimator } from './useAnimator';

interface VirtualTimer {
  cb: () => void;
  due: number;
  cleared: boolean;
}

function mountAnimator() {
  let now = 0;
  const frameCbs: ((t: number) => void)[] = [];
  const timers: VirtualTimer[] = [];
  const { result } = renderHook(() =>
    useAnimator({
      now: () => now,
      requestFrame: (cb) => {
        frameCbs.push(cb);
        return frameCbs.length;
      },
      cancelFrame: () => {},
      setTimer: (cb, ms) => {
        const entry: VirtualTimer = { cb, due: now + ms, cleared: false };
        timers.push(entry);
        return entry;
      },
      clearTimer: (h) => {
        (h as VirtualTimer).cleared = true;
      },
    }),
  );
  const advance = (ms: number): void => {
    const target = now + ms;
    // Walk forward in time, firing the rAF callbacks and any due timers at
    // each step. Step granularity is 16ms so animation ticks resemble what
    // a real rAF loop would produce; due timers are checked at every step.
    while (now < target) {
      const step = Math.min(16, target - now);
      now += step;
      const due = frameCbs.splice(0);
      for (const cb of due) cb(now);
      for (const t of timers) {
        if (!t.cleared && t.due <= now) {
          t.cleared = true;
          t.cb();
        }
      }
    }
  };
  return { animator: result.current, advance };
}

describe('animator.stagger', () => {
  it('factory form fires each child at the right delay', () => {
    const { animator, advance } = mountAnimator();
    const starts: Array<{ item: string; t: number }> = [];
    let elapsed = 0;
    animator.stagger(['a', 'b', 'c'], 50, (item) => {
      starts.push({ item, t: elapsed });
      return animator.tween({
        from: 0,
        to: 1,
        ms: 10,
        easing: (t) => t,
        onTick: () => {},
      });
    });
    // index 0 fires immediately (delay 0).
    expect(starts.map((s) => s.item)).toEqual(['a']);
    elapsed = 50;
    advance(50);
    expect(starts.map((s) => s.item)).toEqual(['a', 'b']);
    elapsed = 100;
    advance(50);
    expect(starts.map((s) => s.item)).toEqual(['a', 'b', 'c']);
  });

  it('builder .tween closes over per-item options', () => {
    const { animator, advance } = mountAnimator();
    const results: Array<{ item: string; v: number; i: number }> = [];
    animator
      .stagger(['a', 'b', 'c'], 0)
      .tween({
        from: 0,
        to: (_item, i) => (i + 1) * 10,
        ms: 100,
        easing: (t) => t,
        onTick: (v, item, i) => results.push({ item, v, i }),
      });
    // All three start immediately (delay = 0); each tween runs 100ms to its
    // per-item `to`. Advance well past completion.
    for (let i = 0; i < 20; i++) advance(16);
    const finals: Record<string, number> = {};
    for (const r of results) finals[r.item] = r.v;
    expect(finals.a).toBeCloseTo(10, 0);
    expect(finals.b).toBeCloseTo(20, 0);
    expect(finals.c).toBeCloseTo(30, 0);
  });

  it('cancel cancels pending timers and in-flight children', () => {
    const { animator, advance } = mountAnimator();
    const starts: string[] = [];
    const cancelledChildren: string[] = [];
    const handle = animator.stagger(['a', 'b', 'c'], 100, (item) => {
      starts.push(item);
      return animator.tween({
        from: 0,
        to: 1,
        ms: 10_000,
        easing: (t) => t,
        onTick: () => {},
        onDone: () => {
          cancelledChildren.push(item);
        },
      });
    });
    // 'a' starts immediately. Advance 50ms; 'b' is still pending.
    advance(50);
    expect(starts).toEqual(['a']);
    handle.cancel();
    advance(500);
    expect(starts).toEqual(['a']);
    // onDone shouldn't fire on cancelled tween.
    expect(cancelledChildren).toEqual([]);
  });
});
