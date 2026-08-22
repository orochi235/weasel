import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from '../useAnimator';
import type { SampledTrack, TimelineHandle } from './types';

/** Manual frame pump so the test owns virtual time. `now` tracks the last
 *  frame, so an animation registered mid-run gets a zero first dt rather than
 *  the whole run as its first sample. */
function pump() {
  const cbs: ((t: number) => void)[] = [];
  let clock = 0;
  return {
    requestFrame: (cb: (t: number) => void) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
    now: () => clock,
    /** Queued frame callbacks, i.e. whether the rAF loop is still running. */
    pending: () => cbs.length,
    frame: (t: number) => { clock = t; const batch = cbs.splice(0); for (const cb of batch) cb(t); },
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

  it('restarts the frame loop when a finished timeline is seeked', () => {
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
    let tl!: TimelineHandle;
    act(() => { tl = result.current.timeline({ tracks: [track] }); });
    act(() => { p.frame(200); });
    expect(result.current.isActive()).toBe(false);
    expect(p.pending()).toBe(0);

    act(() => { tl.seek(20); });
    expect(result.current.isActive()).toBe(true);
    act(() => { p.frame(230); });
    expect(seen.at(-1)).toBe(50);
  });

  it('holds its cancelKey through a revival without cancelling the new claimant', () => {
    const p = pump();
    const ticks: number[] = [];
    const { result } = renderHook(() =>
      useAnimator({ requestFrame: p.requestFrame, cancelFrame: p.cancelFrame, now: p.now }),
    );
    let tl!: TimelineHandle;
    act(() => {
      tl = result.current.timeline({ tracks: [], duration: 100, cancelKey: 'intro' });
    });
    act(() => { p.frame(200); });
    expect(result.current.isActive('intro')).toBe(false);

    act(() => {
      result.current.tween({
        from: 0, to: 1, ms: 1000, cancelKey: 'intro', onTick: (v) => ticks.push(v),
      });
    });
    act(() => { tl.seek(0); });
    act(() => { p.frame(250); });
    expect(ticks).not.toEqual([]);
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
