import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from '../useAnimator';
import type { SampledTrack } from './types';

/** Manual frame pump so the test owns virtual time. */
function pump() {
  const cbs: ((t: number) => void)[] = [];
  return {
    requestFrame: (cb: (t: number) => void) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
    now: () => 0,
    frame: (t: number) => { const batch = cbs.splice(0); for (const cb of batch) cb(t); },
  };
}

describe('animator.timeline', () => {
  it('registers a timeline and drives its tracks', () => {
    const p = pump();
    const seen: number[] = [];
    const { result } = renderHook(() =>
      useAnimator({ requestFrame: p.requestFrame, cancelFrame: p.cancelFrame, now: p.now }),
    );
    const track: SampledTrack<number> = {
      kind: 'sampled',
      keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
      onTick: (v) => seen.push(v),
    };
    act(() => { result.current.timeline({ tracks: [track] }); });
    act(() => { p.frame(50); });
    expect(seen.at(-1)).toBe(50);
  });

  it('is cancellable by key like any other animation', () => {
    const p = pump();
    const { result } = renderHook(() =>
      useAnimator({ requestFrame: p.requestFrame, cancelFrame: p.cancelFrame, now: p.now }),
    );
    act(() => { result.current.timeline({ tracks: [], duration: 1000, cancelKey: 'intro' }); });
    expect(result.current.isActive('intro')).toBe(true);
    act(() => { result.current.cancelKey('intro'); });
    expect(result.current.isActive('intro')).toBe(false);
  });

  it('freezes when the animator is globally paused', () => {
    const p = pump();
    const seen: number[] = [];
    const { result } = renderHook(() =>
      useAnimator({ requestFrame: p.requestFrame, cancelFrame: p.cancelFrame, now: p.now }),
    );
    const track: SampledTrack<number> = {
      kind: 'sampled',
      keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
      onTick: (v) => seen.push(v),
    };
    act(() => { result.current.timeline({ tracks: [track] }); });
    act(() => { p.frame(20); });
    act(() => { result.current.pause(); });
    act(() => { p.frame(80); });
    expect(seen.at(-1)).toBe(20);
  });
});
