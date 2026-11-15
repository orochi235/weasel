import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useElapsed, useElapsedRaf } from './useElapsed';

let hidden = false;

beforeEach(() => {
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setHidden = (next: boolean) => {
  hidden = next;
  document.dispatchEvent(new Event('visibilitychange'));
};

/** A hand-cranked frame clock: `flush(ms)` advances it and runs the outstanding frame. */
function makeClock(origin = 5000) {
  let queued: FrameRequestCallback[] = [];
  let time = origin;
  return {
    requestFrame: (cb: FrameRequestCallback) => { queued.push(cb); return queued.length; },
    cancelFrame: () => { queued = []; },
    advance(ms: number) { time += ms; },
    flush(ms = 16) {
      time += ms;
      const due = queued;
      queued = [];
      for (const cb of due) cb(time);
    },
  };
}

describe('useElapsed', () => {
  it('counts from its first frame, whatever the clock origin and refresh rate', () => {
    for (const [ms, frames] of [[1000 / 60, 120], [1000 / 120, 240]] as const) {
      const clock = makeClock();
      const { result, unmount } = renderHook(() => useElapsed(clock));
      act(() => { clock.flush(ms); });
      for (let i = 0; i < frames; i++) act(() => { clock.flush(ms); });
      expect(result.current).toBeCloseTo(2000, 5);
      unmount();
    }
  });

  it('leaves out the time spent hidden', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useElapsed(clock));
    act(() => { clock.flush(); });
    act(() => { clock.flush(100); });
    expect(result.current).toBe(100);
    act(() => { setHidden(true); });
    clock.advance(60 * 60 * 1000);
    act(() => { setHidden(false); });
    act(() => { clock.flush(16); });
    expect(result.current).toBe(100);
    act(() => { clock.flush(50); });
    expect(result.current).toBe(150);
  });
});

describe('useElapsedRaf', () => {
  it('still runs the caller’s own onResume', () => {
    const clock = makeClock();
    const onResume = vi.fn();
    const seen: number[] = [];
    const { result } = renderHook(() => useElapsedRaf((ms, loop) => { seen.push(ms); loop.request(); }, { ...clock, onResume }));
    act(() => { result.current.request(); });
    act(() => { clock.flush(); });
    act(() => { clock.flush(40); });
    act(() => { setHidden(true); });
    act(() => { setHidden(false); });
    expect(onResume).toHaveBeenCalledTimes(1);
    act(() => { clock.flush(1000); });
    expect(seen).toEqual([0, 40, 40]);
  });
});
