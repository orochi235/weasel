import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { runAt, useRunClock } from '../EffectChartDemo';

/** Drives `frames` animation frames `ms` apart through a stubbed requestAnimationFrame. */
function framesAt(ms: number, frames: number): () => number {
  let queued: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queued.push(cb); return queued.length; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  const { result } = renderHook(() => useRunClock());
  for (let i = 0; i <= frames; i++) {
    const now = queued;
    queued = [];
    act(() => { for (const cb of now) cb(i * ms); });
  }
  return () => result.current;
}

describe('the effect chart run', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps time in seconds whatever the display refresh rate', () => {
    expect(framesAt(1000 / 60, 120)()).toBeCloseTo(2, 5);
    expect(framesAt(1000 / 120, 240)()).toBeCloseTo(2, 5);
  });

  it('flips the quality check every two seconds', () => {
    expect(runAt(1.9).stages.q?.taken).toBe('yes');
    expect(runAt(2.1).stages.q?.taken).toBe('no');
  });
});
