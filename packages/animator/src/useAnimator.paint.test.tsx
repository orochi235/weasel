/** An animator and a loop painting what it drives, on one frame clock: each frame paints that frame's value. */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEffect } from 'react';
import { useVisibleRaf } from '@weasel-js/react';
import { useAnimator } from './useAnimator';

/** Frames requested while one runs wait for the next, as `requestAnimationFrame`'s do. */
function makeClock() {
  let next = 1;
  let now = 0;
  const queued = new Map<number, FrameRequestCallback>();
  return {
    now: () => now,
    requestFrame: (cb: FrameRequestCallback) => {
      const id = next++;
      queued.set(id, cb);
      return id;
    },
    cancelFrame: (id: number) => { queued.delete(id); },
    flush() {
      now += 16;
      const due = [...queued.values()];
      queued.clear();
      for (const cb of due) cb(now);
    },
  };
}

describe('useAnimator and a painting loop', () => {
  it('paints each frame at the value the animator wrote that frame', () => {
    const clock = makeClock();
    let value = 0;
    const painted: number[] = [];
    const { result } = renderHook(() => {
      // The canvas: asks for a paint from every tick, as `<SceneCanvas>` does.
      const paint = useVisibleRaf(() => { painted.push(value); }, clock);
      const animator = useAnimator(clock);
      useEffect(() => animator.onTick(paint.request), [animator, paint]);
      return animator;
    });
    act(() => { result.current.tween({ from: 0, to: 160, ms: 160, onTick: (v) => { value = v; } }); });
    for (let i = 0; i < 5; i++) {
      painted.length = 0;
      act(() => { clock.flush(); });
      expect(painted).toEqual([value]);
    }
  });
});
