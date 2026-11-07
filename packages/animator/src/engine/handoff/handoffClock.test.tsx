import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createClock } from '@weasel-js/clock';
import { linear } from '@weasel-js/geom';
import { useAnimator } from '../../useAnimator';
import { element, type FakeAnimation } from './testing/fakeAnimate';

/** An animator on an outside clock synced by hand, with the document timeline the browser
 *  animations run on standing at the same wall time. */
function setup(rate = 1) {
  const handle = createClock({ rate });
  const queued: ((t: number) => void)[] = [];
  const timeline = { now: 0, animations: [] as FakeAnimation[] };
  Object.defineProperty(document, 'timeline', { configurable: true, value: { get currentTime() { return timeline.now; } } });
  const { result } = renderHook(() => useAnimator({
    clock: handle,
    requestFrame: (cb) => { queued.push(cb); return queued.length; },
    cancelFrame: () => {},
  }));
  act(() => { handle.clock.sync(0); });
  return {
    animator: result.current,
    handle,
    timeline,
    step: (ms: number) => act(() => {
      timeline.now += ms;
      for (const a of timeline.animations) a.advance();
      handle.clock.sync(timeline.now);
      for (const cb of queued.splice(0)) cb(timeline.now);
    }),
  };
}

afterEach(() => { Reflect.deleteProperty(document, 'timeline'); });

describe('a handed-off run on an outside clock', () => {
  it('plays at the clock rate', () => {
    const { animator, step, timeline } = setup(2);
    const e = element(timeline);
    act(() => { animator.tween({ target: e.target, to: { x: 100 }, ms: 1000, easing: linear, compositor: 'auto' }); });
    step(0);
    step(100);
    expect(e.last().playbackRate).toBe(2);
    expect(e.last().currentTime).toBeCloseTo(200, 6);
    step(100);
    expect(e.last().shownX()).toBeCloseTo(40, 6);
  });

  it('follows a seek, forward and back', () => {
    const { animator, handle, step, timeline } = setup(1);
    const e = element(timeline);
    act(() => { animator.tween({ target: e.target, to: { x: 100 }, ms: 1000, easing: linear, compositor: 'auto' }); });
    step(0);
    step(100);
    act(() => { handle.clock.seek(600); });
    step(16);
    expect(e.last().currentTime).toBeCloseTo(616, 6);
    expect(e.target.read().x).toBeCloseTo(61.6, 6);
    act(() => { handle.clock.seek(300); });
    step(16);
    expect(e.last().currentTime).toBeCloseTo(e.target.read().x * 10, 6);
  });

  it('holds still while the clock is paused', () => {
    const { animator, handle, step, timeline } = setup(1);
    const e = element(timeline);
    act(() => { animator.tween({ target: e.target, to: { x: 100 }, ms: 1000, easing: linear, compositor: 'auto' }); });
    step(0);
    step(200);
    act(() => { handle.clock.rate = 0; });
    step(16);
    step(500);
    expect(e.last().currentTime).toBeCloseTo(200, 6);
  });
});
