import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { useAnimator } from './useAnimator';
import { TrimOverrideRegistry } from './trimRegistry';

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => {
      now += dt;
      const due = Array.from(cbs.values());
      cbs.clear();
      for (const cb of due) cb(now);
    },
  };
}

function setup() {
  const clock = makeClock();
  const { result } = renderHook(() => useAnimator(clock));
  const animator = result.current;
  return { animator, registry: animator.trimOverrides, step: (ms: number) => act(() => clock.advance(ms)) };
}

describe('TrimOverrideRegistry', () => {
  it('set + get round-trips an override', () => {
    const r = new TrimOverrideRegistry();
    r.set('a', { end: 0.25 });
    expect(r.get('a')).toEqual({ end: 0.25 });
    expect(r.has('a')).toBe(true);
    expect(r.has('b')).toBe(false);
  });

  it('clear drops the override', () => {
    const r = new TrimOverrideRegistry();
    r.set('a', { start: 0.1, end: 0.5 });
    const v = r.version();
    r.clear('a');
    expect(r.get('a')).toBeUndefined();
    expect(r.has('a')).toBe(false);
    expect(r.version()).toBeGreaterThan(v);
  });

  it('clearAll drops every override', () => {
    const r = new TrimOverrideRegistry();
    r.set('a', { end: 0.5 });
    r.set('b', { start: 0.5 });
    r.clearAll();
    expect(r.get('a')).toBeUndefined();
    expect(r.get('b')).toBeUndefined();
  });

  it('hands every caller for one node the same target, starting on the whole stroke', () => {
    const r = new TrimOverrideRegistry();
    expect(r.target('a')).toBe(r.target('a'));
    expect(r.target('b')).not.toBe(r.target('a'));
    expect(r.target('a').read()).toEqual({ start: 0, end: 1 });
    // Nothing is painted until an animation commits.
    expect(r.get('a')).toBeUndefined();
  });

  it('target tweens end', () => {
    const { animator, registry, step } = setup();
    act(() => {
      animator.tween({ target: registry.target('a'), from: { start: 0, end: 0 }, to: { start: 0, end: 1 }, ms: 100, easing: linear });
    });
    step(0);
    step(50);
    expect(registry.get('a')?.end).toBeCloseTo(0.5, 6);
    expect(registry.resolve('a')?.end).toBeCloseTo(0.5, 6);
    step(50);
    expect(registry.get('a')).toEqual({ start: 0, end: 1 });
  });

  it('bumps the version on every frame the target moves', () => {
    const { animator, registry, step } = setup();
    act(() => {
      animator.tween({ target: registry.target('a'), from: { start: 0, end: 0 }, to: { start: 0, end: 1 }, ms: 100, easing: linear });
    });
    step(0);
    const v = registry.version();
    step(30);
    expect(registry.version()).toBeGreaterThan(v);
  });

  it('adds what a moving target has left to travel on top of an override from set', () => {
    const { animator, registry, step } = setup();
    registry.set('a', { end: 0.5 });
    act(() => {
      animator.tween({ target: registry.target('a'), from: { start: 0, end: 0 }, to: { start: 0, end: 0.2 }, ms: 100, easing: linear });
    });
    step(0);
    step(50);
    // Halfway: the tween has 0.1 of its 0.2 left, carried on the override's end.
    expect(registry.resolve('a')?.end).toBeCloseTo(0.4, 6);
    expect(registry.resolve('a')?.start).toBeUndefined();
    step(50);
    expect(registry.resolve('a')).toEqual({ end: 0.5 });
  });

  it('release drops a resting target, and the old target throws from then on', () => {
    const { animator, registry, step } = setup();
    const target = registry.target('a');
    act(() => { animator.tween({ target, to: { start: 0, end: 0.5 }, ms: 10, easing: linear }); });
    step(0);
    step(10);
    expect(registry.get('a')).toEqual({ start: 0, end: 0.5 });
    registry.release('a');
    expect(registry.has('a')).toBe(false);
    expect(registry.get('a')).toBeUndefined();
    expect(() => target.commit({ start: 0, end: 1 })).toThrow('released');
    expect(registry.target('a')).not.toBe(target);
  });

  it('keeps a target an animation is still moving through clear', () => {
    const { animator, registry, step } = setup();
    act(() => {
      animator.tween({ target: registry.target('a'), from: { start: 0, end: 0 }, to: { start: 0, end: 1 }, ms: 100, easing: linear });
    });
    step(0);
    registry.clear('a');
    step(50);
    expect(registry.get('a')?.end).toBeCloseTo(0.5, 6);
  });

  it('is cleared when its animator unmounts', () => {
    const clock = makeClock();
    const { result, unmount } = renderHook(() => useAnimator(clock));
    const registry = result.current.trimOverrides;
    registry.set('a', { end: 0.5 });
    unmount();
    expect(registry.has('a')).toBe(false);
  });
});
