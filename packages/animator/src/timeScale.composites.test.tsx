import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { useAnimator } from './useAnimator';
import { createTarget } from './target';
import type { EventTrack, SampledTrack } from './timeline/types';

function setup() {
  let now = 0;
  const callbacks = new Map<number, (t: number) => void>();
  let next = 1;
  const clock = {
    now: () => now,
    requestFrame: (cb: (t: number) => void): number => { callbacks.set(next, cb); return next++; },
    cancelFrame: (h: number): void => { callbacks.delete(h); },
  };
  const step = (ms: number) => act(() => {
    now += ms;
    const due = Array.from(callbacks.values());
    callbacks.clear();
    for (const cb of due) cb(now);
  });
  const { result } = renderHook(() => useAnimator(clock));
  return { animator: result.current, step };
}

const ramp = (seen: number[]): SampledTrack<number> => ({
  kind: 'sampled',
  keys: [{ t: 0, value: 0 }, { t: 1000, value: 100 }],
  onTick: (v) => seen.push(v),
});

describe('a timeline played backward', () => {
  it('runs its playhead back to 0, samples its start, and ends there', () => {
    const { animator, step } = setup();
    const seen: number[] = [];
    const onDone = vi.fn();
    let tl!: ReturnType<typeof animator.timeline>;
    act(() => { tl = animator.timeline({ tracks: [ramp(seen)], onDone }); });
    step(0);
    step(400);
    expect(tl.time()).toBeCloseTo(400, 6);
    act(() => { tl.setTimeScale(-1); });
    step(100);
    expect(tl.time()).toBeCloseTo(300, 6);
    expect(seen.at(-1)).toBeCloseTo(30, 6);
    step(400);
    expect(tl.time()).toBe(0);
    expect(seen.at(-1)).toBe(0);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(animator.isActive()).toBe(false);
  });

  it('fires no events going back, and fires them again going forward over them', () => {
    const { animator, step } = setup();
    const fire = vi.fn();
    const events: EventTrack = { kind: 'event', events: [{ t: 200, fire }] };
    let tl!: ReturnType<typeof animator.timeline>;
    act(() => { tl = animator.timeline({ tracks: [events], duration: 1000 }); });
    step(0);
    step(300);
    expect(fire).toHaveBeenCalledTimes(1);
    act(() => { tl.setTimeScale(-1); });
    step(200);
    expect(fire).toHaveBeenCalledTimes(1);
    act(() => { tl.setTimeScale(1); });
    step(200);
    expect(fire).toHaveBeenCalledTimes(2);
  });

  it('crosses back into the laps it has looped through before it ends', () => {
    const { animator, step } = setup();
    const seen: number[] = [];
    let tl!: ReturnType<typeof animator.timeline>;
    act(() => { tl = animator.timeline({ tracks: [ramp(seen)], loop: true }); });
    step(0);
    step(1200);
    expect(tl.time()).toBeCloseTo(200, 6);
    act(() => { animator.setTimeScale(-1); });
    step(300);
    expect(tl.time()).toBeCloseTo(900, 6);
    expect(seen.at(-1)).toBeCloseTo(90, 6);
    step(1000);
    expect(tl.time()).toBe(0);
    expect(animator.isActive()).toBe(false);
  });
});

describe('a composite played backward', () => {
  it('a stagger ends once the items running have run back to their starts', () => {
    const { animator, step } = setup();
    let a = 0;
    let b = 0;
    const ta = createTarget<number>({ get: () => a, set: (v) => { a = v; } });
    const tb = createTarget<number>({ get: () => b, set: (v) => { b = v; } });
    let st!: ReturnType<typeof animator.stagger>;
    act(() => {
      st = animator.stagger([ta, tb], 300, (t) => animator.tween({ target: t, to: 100, ms: 1000, easing: linear }));
    });
    step(0);
    step(300);
    step(200);
    expect(ta.read()).toBeCloseTo(50, 6);
    expect(tb.read()).toBeCloseTo(20, 6);
    act(() => { st.setTimeScale(-1); });
    step(250);
    expect(tb.read()).toBe(0);
    expect(ta.read()).toBeCloseTo(25, 6);
    expect(animator.isActive()).toBe(true);
    step(300);
    expect(ta.read()).toBe(0);
    step(16);
    expect(animator.isActive()).toBe(false);
  });

  it('a loop ends once the pass in flight has run back to its start', () => {
    const { animator, step } = setup();
    const seen: number[] = [];
    const onDone = vi.fn();
    act(() => {
      animator.tweenLoop({ from: 0, to: 100, ms: 1000, easing: linear, onTick: (v) => seen.push(v), onDone });
    });
    step(0);
    step(1000);
    step(300);
    expect(seen.at(-1)).toBeCloseTo(30, 6);
    act(() => { animator.setTimeScale(-1); });
    step(400);
    expect(seen.at(-1)).toBe(0);
    expect(onDone).toHaveBeenCalledTimes(1);
    step(16);
    expect(animator.isActive()).toBe(false);
  });
});
