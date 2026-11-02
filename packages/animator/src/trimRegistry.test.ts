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
  const registry = animator.trimOverrides;
  return {
    animator,
    registry,
    step: (ms: number) => act(() => clock.advance(ms)),
    /** Starts a linear tween of `id`'s `end` from 0 to `to` over `ms`. */
    drawOn: (id: string, to = 1, ms = 100) => act(() => {
      animator.tween({ target: registry.target(id, 'end'), from: 0, to, ms, easing: linear });
    }),
  };
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

  it('hands every caller for one node and edge the same target, starting on the whole stroke', () => {
    const r = new TrimOverrideRegistry();
    expect(r.target('a', 'end')).toBe(r.target('a', 'end'));
    expect(r.target('a', 'start')).not.toBe(r.target('a', 'end'));
    expect(r.target('b', 'end')).not.toBe(r.target('a', 'end'));
    expect(r.target('a', 'start').read()).toBe(0);
    expect(r.target('a', 'end').read()).toBe(1);
  });

  it('counts a target asked for and never moved as nothing', () => {
    const r = new TrimOverrideRegistry();
    r.target('a', 'end');
    expect(r.has('a')).toBe(false);
    expect(r.resolve('a')).toBeUndefined();
  });

  it('target tweens end', () => {
    const { registry, step, drawOn } = setup();
    drawOn('a');
    step(0);
    step(50);
    expect(registry.get('a')?.end).toBeCloseTo(0.5, 6);
    step(50);
    expect(registry.get('a')).toEqual({ end: 1 });
  });

  it("paints only the edge a target moves, so the stroke's own other edge stands", () => {
    const { registry, step, drawOn } = setup();
    drawOn('a');
    step(0);
    step(50);
    expect(registry.resolve('a')).toEqual({ end: expect.closeTo(0.5, 6) });
    step(50);
    expect(registry.resolve('a')).toEqual({ end: 1 });
  });

  it("composes set's edge with a target's other edge, mid-flight and at rest", () => {
    const { registry, step, drawOn } = setup();
    registry.set('a', { start: 0.2 });
    drawOn('a');
    step(0);
    step(50);
    expect(registry.resolve('a')).toEqual({ start: 0.2, end: expect.closeTo(0.5, 6) });
    step(50);
    expect(registry.resolve('a')).toEqual({ start: 0.2, end: 1 });
  });

  it('paints an end tween at rest as set({ end }) paints', () => {
    const { registry, step, drawOn } = setup();
    drawOn('a', 0.75);
    step(0);
    step(100);
    const other = new TrimOverrideRegistry();
    other.set('a', { end: 0.75 });
    expect(registry.resolve('a')).toEqual(other.resolve('a'));
  });

  it('bumps the version on every frame a target moves', () => {
    const { registry, step, drawOn } = setup();
    drawOn('a');
    step(0);
    const v = registry.version();
    step(30);
    expect(registry.version()).toBeGreaterThan(v);
  });

  it("adds what a moving target has left to travel on top of set's value for that edge", () => {
    const { registry, step, drawOn } = setup();
    registry.set('a', { end: 0.5 });
    drawOn('a', 0.2);
    step(0);
    step(50);
    // Halfway: the tween has 0.1 of its 0.2 left, carried on the override's end.
    expect(registry.resolve('a')?.end).toBeCloseTo(0.4, 6);
    expect(registry.resolve('a')?.start).toBeUndefined();
    step(50);
    expect(registry.resolve('a')).toEqual({ end: 0.5 });
  });

  it('release drops a resting target, and the old target throws from then on', () => {
    const { registry, step, drawOn } = setup();
    const target = registry.target('a', 'end');
    drawOn('a', 0.5, 10);
    step(0);
    step(10);
    expect(registry.get('a')).toEqual({ end: 0.5 });
    registry.release('a', 'end');
    expect(registry.has('a')).toBe(false);
    expect(registry.get('a')).toBeUndefined();
    expect(() => target.commit(1)).toThrow('released');
    expect(registry.target('a', 'end')).not.toBe(target);
  });

  it('keeps a target an animation is still moving through clear', () => {
    const { registry, step, drawOn } = setup();
    drawOn('a');
    step(0);
    registry.clear('a');
    step(50);
    expect(registry.get('a')?.end).toBeCloseTo(0.5, 6);
  });

  it('tells subscribers of a set and a clear, and of nothing an animation frame does', () => {
    const { registry, step, drawOn } = setup();
    let told = 0;
    const off = registry.subscribe(() => { told += 1; });
    registry.set('a', { end: 0.5 });
    expect(told).toBe(1);
    registry.clear('a');
    expect(told).toBe(2);
    drawOn('b');
    step(0);
    step(50);
    expect(told).toBe(2);
    off();
    registry.set('a', { end: 0.5 });
    expect(told).toBe(2);
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
