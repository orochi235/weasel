import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { useAnimator } from './useAnimator';
import { createTarget } from './target';
import { createTargetTable } from './targetTable';

function setup(start = 10) {
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
  let committed = start;
  const target = createTarget<number>({ get: () => committed, set: (v) => { committed = v; } });
  return { animator: result.current, step, target, pending: () => callbacks.size };
}

describe('a time scale', () => {
  it('is refused where it is no finite number', () => {
    const { animator, step, target } = setup();
    let tw!: ReturnType<typeof animator.tween>;
    act(() => { tw = animator.tween({ target, to: 50, ms: 1000, easing: linear, cancelKey: 'k' }); });
    step(0);
    expect(() => animator.setTimeScale(Number.NaN)).toThrow(/time scale/);
    expect(() => tw.setTimeScale(Number.POSITIVE_INFINITY)).toThrow(/time scale/);
    expect(() => animator.setTimeScaleByKey('k', Number.NEGATIVE_INFINITY)).toThrow(/time scale/);
    expect(animator.timeScale()).toBe(1);
    expect(tw.timeScale()).toBe(1);
  });

  it('takes 0, which holds every animation still', () => {
    const { animator, step, target } = setup();
    act(() => { animator.tween({ target, to: 50, ms: 1000, easing: linear }); });
    step(0);
    step(300);
    act(() => { animator.setTimeScale(0); });
    step(500);
    expect(target.read()).toBeCloseTo(22, 6);
  });
});

describe('a time scale below 0', () => {
  it('plays a tween on a target back to its start, where it ends holding its start value', () => {
    const { animator, step, target, pending } = setup();
    const onDone = vi.fn();
    let tw!: ReturnType<typeof animator.tween>;
    act(() => { tw = animator.tween({ target, to: 50, ms: 1000, easing: linear, onDone }); });
    step(0);
    step(300);
    expect(target.read()).toBeCloseTo(22, 6);
    act(() => { tw.setTimeScale(-1); });
    step(200);
    expect(target.read()).toBeCloseTo(14, 6);
    expect(tw.timeScale()).toBe(-1);
    step(200);
    expect(target.read()).toBe(10);
    expect(target.committed()).toBe(10);
    expect(target.active).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
    step(16);
    expect(pending()).toBe(0);
  });

  it('plays forward again from where it is when the scale comes back above 0', () => {
    const { animator, step, target } = setup();
    let tw!: ReturnType<typeof animator.tween>;
    act(() => { tw = animator.tween({ target, to: 50, ms: 1000, easing: linear }); });
    step(0);
    step(500);
    act(() => { tw.setTimeScale(-1); });
    step(250);
    expect(target.read()).toBeCloseTo(20, 6);
    act(() => { tw.setTimeScale(2); });
    step(100);
    expect(target.read()).toBeCloseTo(28, 6);
    step(400);
    expect(target.read()).toBe(50);
    expect(target.active).toBe(false);
  });

  it('hands a tween\'s onTick its `from` as it ends at its start', () => {
    const { animator, step } = setup();
    const seen: number[] = [];
    const onDone = vi.fn();
    act(() => {
      animator.tween({ from: 0, to: 100, ms: 1000, easing: linear, onTick: (v) => seen.push(v), onDone, cancelKey: 'k' });
    });
    step(0);
    step(400);
    act(() => { animator.setTimeScaleByKey('k', -2); });
    step(100);
    expect(seen.at(-1)).toBeCloseTo(20, 6);
    step(150);
    expect(seen.at(-1)).toBe(0);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(animator.isActive('k')).toBe(false);
  });

  it('on the animator plays everything backward while its clock goes on forward', () => {
    const { animator, step, target } = setup();
    let tw!: ReturnType<typeof animator.tween>;
    act(() => { tw = animator.tween({ target, to: 50, ms: 1000, easing: linear }); });
    step(0);
    step(300);
    act(() => { animator.setTimeScale(-1); });
    expect(animator.timeScale()).toBe(-1);
    expect(tw.timeScale()).toBe(1);
    step(100);
    expect(target.read()).toBeCloseTo(18, 6);
    expect(animator.live()[0]!.elapsed).toBeCloseTo(200, 6);
    act(() => { animator.setTimeScale(1); });
    step(100);
    expect(target.read()).toBeCloseTo(22, 6);
    act(() => { animator.setTimeScale(-1); tw.setTimeScale(-1); });
    step(100);
    expect(target.read()).toBeCloseTo(26, 6);
  });

  it('ends at once an animation started while the animator plays backward', () => {
    const { animator, step, target } = setup();
    const onDone = vi.fn();
    act(() => { animator.setTimeScale(-1); });
    act(() => { animator.tween({ target, to: 50, ms: 1000, easing: linear, onDone }); });
    step(0);
    step(16);
    expect(target.read()).toBe(10);
    expect(target.committed()).toBe(10);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('plays a spring on a target back to its start', () => {
    const { animator, step, target } = setup(0);
    const onDone = vi.fn();
    let sp!: ReturnType<typeof animator.spring>;
    act(() => { sp = animator.spring({ target, to: 100, stiffness: 170, damping: 26, onDone }); });
    step(0);
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) { step(20); seen.push(target.read()); }
    act(() => { sp.setTimeScale(-1); });
    step(20);
    step(20);
    expect(target.read()).toBeCloseTo(seen[7]!, 1);
    for (let i = 0; i < 10; i++) step(20);
    expect(target.read()).toBe(0);
    expect(target.committed()).toBe(0);
    expect(target.active).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows a target table row back at its start in the table\'s own pass', () => {
    const { animator, step } = setup();
    const table = createTargetTable({ axes: 2 });
    const row = table.add([10, 20]);
    const other = table.add([0, 0]);
    let tw!: ReturnType<typeof animator.tween>;
    act(() => {
      tw = animator.tween({ target: table.target(row), to: [50, 60], ms: 1000, easing: linear });
      animator.tween({ target: table.target(other), to: [5, 5], ms: 5000, easing: linear });
    });
    step(0);
    step(500);
    expect(Array.from(table.shown.subarray(0, 2))).toEqual([30, 40]);
    act(() => { tw.setTimeScale(-1); });
    step(250);
    expect(table.shown[0]).toBeCloseTo(20, 6);
    step(300);
    expect(Array.from(table.shown.subarray(0, 2))).toEqual([10, 20]);
    expect(Array.from(table.committed.subarray(0, 2))).toEqual([10, 20]);
    step(16);
    expect(Array.from(table.shown.subarray(0, 2))).toEqual([10, 20]);
  });

  it('leaves a full hold showing its value while what it covers plays back to its start', () => {
    const { animator, step, target } = setup();
    let tw!: ReturnType<typeof animator.tween>;
    let held!: ReturnType<typeof animator.hold>;
    act(() => {
      tw = animator.tween({ target, to: 50, ms: 1000, easing: linear });
      held = animator.hold({ target, value: 99 });
    });
    step(0);
    step(500);
    expect(target.read()).toBe(99);
    act(() => { tw.setTimeScale(-1); });
    step(600);
    expect(target.read()).toBe(99);
    expect(target.committed()).toBe(10);
    act(() => { held.release({ commit: false }); });
    expect(target.read()).toBe(10);
  });

  it('holds a spring\'s redirected share where it was redirected, while the rest plays back on', () => {
    const { animator, step, target } = setup(0);
    let sp!: ReturnType<typeof animator.physics<number>>;
    act(() => { sp = animator.physics({ target, from: -50, to: 100, stiffness: 170, damping: 26 }); });
    step(0);
    for (let i = 0; i < 5; i++) step(20);
    act(() => { sp.setTarget(200); });
    for (let i = 0; i < 5; i++) step(20);
    act(() => { sp.setTimeScale(-1); });
    let last = target.read();
    let jump = 0;
    for (let i = 0; i < 9; i++) {
      step(20);
      jump = Math.max(jump, Math.abs(target.read() - last));
      last = target.read();
    }
    expect(jump).toBeLessThan(30);
    expect(target.active).toBe(true);
  });

  it('plays a coast back to where it started', () => {
    const { animator, step, target } = setup(5);
    let d!: ReturnType<typeof animator.decay>;
    act(() => { d = animator.decay({ target, velocity: 1000, friction: 0.5 }); });
    step(0);
    step(200);
    step(200);
    expect(target.read()).toBeGreaterThan(100);
    act(() => { d.setTimeScale(-1); });
    step(200);
    step(250);
    expect(target.read()).toBe(5);
    expect(target.committed()).toBe(5);
    expect(target.active).toBe(false);
  });
});
