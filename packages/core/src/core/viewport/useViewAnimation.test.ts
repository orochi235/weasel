import { describe, it, expect, vi } from 'vitest';
import { StrictMode, createElement, type ReactNode } from 'react';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { renderHook, act } from '@testing-library/react';
import { DEFAULT_VIEW_ANIMATION_MS, useViewAnimation, type ViewAnimationApi, type ViewChannel } from './useViewAnimation';
import { KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import { useAnimator } from '@weasel-js/animator/react';
import { linear } from '@weasel-js/geom';
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
    expect(writes).toHaveLength(3);
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

  it('takes its default duration from view.animationMs, else DEFAULT_VIEW_ANIMATION_MS', () => {
    const doneAfter = (settings: KitSettingsOverrides | null): number => {
      const clock = makeClock();
      const { channel } = makeChannel(HOME);
      const { result } = renderHook(
        () => useViewAnimation(channel, useAnimator(clock)),
        settings ? { wrapper: ({ children }: { children: ReactNode }) => createElement(KitSettingsProvider, { value: settings }, children) } : undefined,
      );
      const done = vi.fn();
      act(() => { result.current.animate({ x: 5, y: 5, scale: { x: 1, y: 1 } }, { onDone: done }); });
      let elapsed = 0;
      while (!done.mock.calls.length && elapsed < 5000) {
        act(() => { clock.advance(10); });
        elapsed += 10;
      }
      return elapsed;
    };
    expect(doneAfter(null)).toBe(DEFAULT_VIEW_ANIMATION_MS);
    expect(doneAfter({ view: { animationMs: 80 } })).toBe(80);
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

describe('useViewAnimation zoom invariant', () => {
  it('never targets or lands on a zero scale', () => {
    const clock = makeClock();
    const { channel, current } = makeChannel(HOME);
    const { result } = mount(channel, clock);
    act(() => { result.current.animate({ x: 0, y: 0, scale: { x: 0, y: 0 } }, { ms: 100, easing: linear }); });
    const target = result.current.target()!;
    expect(target.scale.x > 0 && Number.isFinite(target.scale.x)).toBe(true);
    act(() => { clock.advance(100); });
    expect(current().scale.x > 0 && Number.isFinite(current().scale.x)).toBe(true);
    expect(Number.isFinite(current().x)).toBe(true);
  });

  it('animates the committed channel, not one an abandoned render passed', () => {
    const clock = makeClock();
    const a = makeChannel(HOME);
    const b = makeChannel(HOME);
    let api = null as ViewAnimationApi | null;
    function Probe({ channel }: { channel: ViewChannel }) {
      api = useViewAnimation(channel, useAnimator(clock));
      return null;
    }
    renderThenAbandon(a.channel, b.channel, (channel) => createElement(Probe, { channel }));

    act(() => { api!.animate(zoomAt(HOME, { x: 0, y: 0 }, 2), { ms: 100, easing: linear }); });
    act(() => { clock.advance(100); });
    expect(b.writes).toEqual([]);
    expect(a.current().scale.x).toBeCloseTo(2, 10);
  });
});

/** The runner beside the animator it runs on, for a second animation on the same view. */
function mountWithAnimator(channel: ViewChannel, clock: ReturnType<typeof makeClock>) {
  return renderHook(() => {
    const animator = useAnimator(clock);
    return { animator, camera: useViewAnimation(channel, animator) };
  });
}

const at = (x: number, y = 0): View => ({ x, y, scale: { x: 1, y: 1 } });

describe('the view target', () => {
  it('adds a second animation to a camera animation in flight', () => {
    const clock = makeClock();
    const { channel, current } = makeChannel(HOME);
    const { result } = mountWithAnimator(channel, clock);
    const { animator, camera } = result.current;

    act(() => { camera.animate(at(100), { ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    expect(current().x).toBeCloseTo(50, 10);

    act(() => { animator.tween({ target: camera.viewTarget, to: at(100, 40), ms: 200, easing: linear }); });
    expect(camera.isAnimating()).toBe(true);
    act(() => { clock.advance(50); });
    expect(current().x).toBeCloseTo(75, 10);
    expect(current().y).toBeCloseTo(10, 10);
    act(() => { clock.advance(50); });
    expect(camera.isAnimating()).toBe(false);
    expect(current().x).toBeCloseTo(100, 10);
    expect(current().y).toBeCloseTo(20, 10);
    act(() => { clock.advance(100); });
    expect(current()).toEqual(at(100, 40));
  });

  it('keeps the destination to itself: the channel reads the live view mid-flight', () => {
    const clock = makeClock();
    const { channel } = makeChannel(HOME);
    const { result } = mountWithAnimator(channel, clock);
    const { camera } = result.current;

    act(() => { camera.animate(at(100), { ms: 200, easing: linear }); });
    expect(channel.get()).toEqual(HOME);
    act(() => { clock.advance(100); });
    expect(channel.get().x).toBeCloseTo(50, 10);
    expect(camera.viewTarget.read().x).toBeCloseTo(50, 10);
    expect(camera.target()!.x).toBe(100);
  });

  it('carries an animation that is not the runner\'s through an outside write', () => {
    const clock = makeClock();
    let v: View = HOME;
    const api = { current: null as ViewAnimationApi | null };
    const channel: ViewChannel = {
      get: () => v,
      set: (next) => { api.current!.stopIfExternal(); v = next; },
    };
    const { result } = mountWithAnimator(channel, clock);
    const { animator, camera } = result.current;
    api.current = camera;

    // A nudge: 20 out, settling back over 200ms.
    act(() => { animator.tween({ target: camera.viewTarget, from: at(20), to: HOME, ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    expect(v.x).toBeCloseTo(10, 10);

    // The writer read a view 10 off its base and put it at 50, so the base is 40.
    act(() => { channel.set(at(50)); });
    expect(v).toEqual(at(50));
    act(() => { clock.advance(50); });
    expect(v.x).toBeCloseTo(45, 10);
    act(() => { clock.advance(50); });
    expect(v.x).toBeCloseTo(40, 10);
  });

  it('stop() leaves another animation on the view running from where the camera was', () => {
    const clock = makeClock();
    const { channel, current } = makeChannel(HOME);
    const { result } = mountWithAnimator(channel, clock);
    const { animator, camera } = result.current;

    act(() => { camera.animate(at(100), { ms: 200, easing: linear }); });
    act(() => { animator.tween({ target: camera.viewTarget, to: at(100, 40), ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    act(() => { camera.stop(); });
    act(() => { clock.advance(100); });
    expect(current().x).toBeCloseTo(50, 10);
    expect(current().y).toBeCloseTo(40, 10);
  });

  it('has landed the view by the time onDone runs', () => {
    const clock = makeClock();
    const { channel, current } = makeChannel(HOME);
    const { result } = mountWithAnimator(channel, clock);
    let seen: View | null = null;

    act(() => { result.current.camera.animate(at(100), { ms: 100, easing: linear, onDone: () => { seen = current(); } }); });
    act(() => { clock.advance(50); });
    act(() => { clock.advance(50); });
    expect(seen).toEqual(at(100));
  });

  it('starts an animation chained from onDone at the destination, not a frame behind it', () => {
    const clock = makeClock();
    const { channel, current } = makeChannel(HOME);
    const { result } = mountWithAnimator(channel, clock);
    const { camera } = result.current;

    act(() => {
      camera.animate(at(100), {
        ms: 100, easing: linear,
        onDone: () => camera.animate((base) => at(base.x + 100), { ms: 100, easing: linear }),
      });
    });
    act(() => { clock.advance(50); });
    act(() => { clock.advance(50); });
    expect(current().x).toBeCloseTo(100, 10);
    act(() => { clock.advance(50); });
    expect(current().x).toBeCloseTo(150, 10);
  });
});
