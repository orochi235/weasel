import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useFrameSchedule } from './useFrameSchedule';

let frames: FrameRequestCallback[] = [];

afterEach(() => {
  cleanup();
  frames = [];
  vi.unstubAllGlobals();
});

function stubFrames() {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
}

const tick = () =>
  act(() => {
    const due = frames;
    frames = [];
    for (const cb of due) cb(performance.now());
  });

it('runs every distinct function handed to it before the frame, each once', () => {
  stubFrames();
  const { result } = renderHook(() => useFrameSchedule());
  const a = vi.fn();
  const b = vi.fn();
  act(() => {
    result.current(a);
    result.current(b);
    result.current(a);
  });
  tick();
  expect(a).toHaveBeenCalledTimes(1);
  expect(b).toHaveBeenCalledTimes(1);
});

it('runs a function that asks again from inside its frame on the next one', () => {
  stubFrames();
  const { result } = renderHook(() => useFrameSchedule());
  let runs = 0;
  const again = () => {
    runs++;
    if (runs < 2) result.current(again);
  };
  act(() => result.current(again));
  tick();
  expect(runs).toBe(1);
  tick();
  expect(runs).toBe(2);
});
