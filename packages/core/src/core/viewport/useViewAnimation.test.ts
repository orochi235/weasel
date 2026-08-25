import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useViewAnimation, type ViewChannel } from './useViewAnimation';
import { useAnimator } from '../../animation/useAnimator';
import { linear } from '../../animation/easings';
import { zoomAt } from './zoomAt';
import type { View } from './view';

/** A hand-driven rAF: one queued frame per `advance`, at a clock we control.
 *  `useAnimator` seeds `lastRealNow` from `now()` at registration, so the first
 *  advance already carries the elapsed time. */
function makeClock() {
  let t = 0;
  let queue: Array<(ts: number) => void> = [];
  return {
    now: () => t,
    requestFrame: (cb: (ts: number) => void) => { queue.push(cb); return queue.length; },
    cancelFrame: () => {},
    advance(ms: number) {
      t += ms;
      const due = queue;
      queue = [];
      for (const cb of due) cb(t);
    },
  };
}

function makeChannel(initial: View) {
  let v = initial;
  const writes: View[] = [];
  const channel: ViewChannel = { get: () => v, set: (next) => { v = next; writes.push(next); } };
  return { channel, writes, current: () => v };
}

function mount(channel: ViewChannel, clock: ReturnType<typeof makeClock>, strict = false) {
  return renderHook(
    () => useViewAnimation(channel, useAnimator(clock)),
    strict ? { wrapper: StrictMode } : undefined,
  );
}

const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

describe('useViewAnimation', () => {
  it('writes the view every frame and lands exactly on the target', () => {
    const clock = makeClock();
    const { channel, writes, current } = makeChannel(HOME);
    const { result } = mount(channel, clock);

    const target = zoomAt(HOME, { x: 100, y: 50 }, 4);
    act(() => { result.current.animate(target, { ms: 200, easing: linear }); });

    act(() => { clock.advance(100); });
    expect(current().scale.x).toBeCloseTo(2, 10); // sqrt(1*4) at the halfway point
    expect(result.current.isAnimating()).toBe(true);

    act(() => { clock.advance(100); });
    expect(current().scale.x).toBeCloseTo(4, 10);
    expect(current().x).toBeCloseTo(target.x, 10);
    expect(result.current.isAnimating()).toBe(false);
    expect(writes).toHaveLength(2);
  });

  it('fires onDone once, at the target', () => {
    const clock = makeClock();
    const { channel } = makeChannel(HOME);
    const { result } = mount(channel, clock);
    const done = vi.fn();

    act(() => { result.current.animate({ x: 5, y: 5, scale: { x: 1, y: 1 } }, { ms: 100, onDone: done }); });
    act(() => { clock.advance(50); });
    expect(done).not.toHaveBeenCalled();
    act(() => { clock.advance(50); });
    expect(done).toHaveBeenCalledTimes(1);
    act(() => { clock.advance(50); });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('starts a retarget from the live view, not from a captured start', () => {
    const clock = makeClock();
    const { channel, current } = makeChannel(HOME);
    const { result } = mount(channel, clock);

    act(() => { result.current.animate({ x: 100, y: 0, scale: { x: 1, y: 1 } }, { ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    expect(current().x).toBeCloseTo(50, 10);

    act(() => { result.current.animate({ x: 0, y: 0, scale: { x: 1, y: 1 } }, { ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    // Halfway back from 50, not from 0 or 100.
    expect(current().x).toBeCloseTo(25, 10);
  });

  it('compounds a thunked retarget off the pending target', () => {
    const clock = makeClock();
    const { channel } = makeChannel(HOME);
    const { result } = mount(channel, clock);

    act(() => { result.current.animate((base) => zoomAt(base, { x: 0, y: 0 }, 2), { ms: 200 }); });
    act(() => { clock.advance(20); });
    act(() => { result.current.animate((base) => zoomAt(base, { x: 0, y: 0 }, 2), { ms: 200 }); });

    // 2 x 2, off the pending target — not 2 x (wherever frame one landed).
    expect(result.current.target()!.scale.x).toBeCloseTo(4, 10);
  });

  it('stop() leaves the view where it is and clears the target', () => {
    const clock = makeClock();
    const { channel, current } = makeChannel(HOME);
    const { result } = mount(channel, clock);

    act(() => { result.current.animate({ x: 100, y: 0, scale: { x: 1, y: 1 } }, { ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    act(() => { result.current.stop(); });
    const held = current();

    act(() => { clock.advance(500); });
    expect(current()).toEqual(held);
    expect(current().x).toBeCloseTo(50, 10);
    expect(result.current.target()).toBeNull();
    expect(result.current.isAnimating()).toBe(false);
  });

  it('stopIfExternal() cancels an outside write but not the runner\'s own tick', () => {
    const clock = makeClock();
    let v: View = HOME;
    // Every write re-enters stopIfExternal, the way the `view` dep does.
    const api = { current: null as ReturnType<typeof useViewAnimation> | null };
    const channel: ViewChannel = {
      get: () => v,
      set: (next) => { api.current!.stopIfExternal(); v = next; },
    };
    const { result } = mount(channel, clock);
    api.current = result.current;

    act(() => { result.current.animate({ x: 100, y: 0, scale: { x: 1, y: 1 } }, { ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    expect(result.current.isAnimating()).toBe(true);
    expect(v.x).toBeCloseTo(50, 10);

    act(() => { channel.set({ x: 7, y: 7, scale: { x: 1, y: 1 } }); });
    expect(result.current.isAnimating()).toBe(false);
    act(() => { clock.advance(100); });
    expect(v).toEqual({ x: 7, y: 7, scale: { x: 1, y: 1 } });
  });

  it('animateToBounds fits and animates', () => {
    const clock = makeClock();
    const { channel, current } = makeChannel(HOME);
    const { result } = mount(channel, clock);

    act(() => {
      result.current.animateToBounds(
        { x: 0, y: 0, width: 200, height: 100 },
        { width: 400, height: 200 },
        { padding: 0, ms: 100, easing: linear },
      );
    });
    act(() => { clock.advance(100); });
    expect(current().scale.x).toBeCloseTo(2, 10);
    expect(current().x).toBeCloseTo(0, 10);
    expect(current().y).toBeCloseTo(0, 10);
  });

  it('does not strand a second runner sharing one animator', () => {
    const clock = makeClock();
    const a = makeChannel(HOME);
    const b = makeChannel(HOME);
    const { result } = renderHook(() => {
      const animator = useAnimator(clock);
      return { a: useViewAnimation(a.channel, animator), b: useViewAnimation(b.channel, animator) };
    });

    act(() => { result.current.a.animate({ x: 100, y: 0, scale: { x: 1, y: 1 } }, { ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    expect(a.current().x).toBeCloseTo(50, 10);

    act(() => { result.current.b.animate({ x: 20, y: 0, scale: { x: 1, y: 1 } }, { ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });

    // A is nobody's business but A's: starting B must neither freeze it nor
    // hand it B's answers.
    expect(a.current().x).toBeCloseTo(100, 10);
    expect(result.current.a.isAnimating()).toBe(false);
    expect(result.current.a.target()).toBeNull();
    expect(b.current().x).toBeCloseTo(10, 10);
    expect(result.current.b.isAnimating()).toBe(true);
    expect(result.current.b.target()!.x).toBeCloseTo(20, 10);
  });

  it('reports isAnimating correctly through a StrictMode remount', () => {
    const clock = makeClock();
    const { channel } = makeChannel(HOME);
    const { result } = mount(channel, clock, true);

    expect(result.current.isAnimating()).toBe(false);
    act(() => { result.current.animate({ x: 9, y: 0, scale: { x: 1, y: 1 } }, { ms: 100 }); });
    expect(result.current.isAnimating()).toBe(true);
  });
});
