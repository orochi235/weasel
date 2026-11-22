import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useFollowed } from './useFollowed';

let frames: FrameRequestCallback[] = [];

afterEach(() => {
  cleanup();
  frames = [];
  vi.unstubAllGlobals();
});

const tick = () =>
  act(() => {
    const due = frames;
    frames = [];
    for (const cb of due) cb(performance.now());
  });

it('re-renders when what it reads moves outside React, and not while it holds still', () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  let camera = { zoom: 1, pan: { x: 0, y: 0 } };
  let renders = 0;
  const { result } = renderHook(() => {
    renders++;
    return useFollowed(() => camera);
  });
  tick();
  const settled = renders;
  tick();
  expect(renders).toBe(settled);
  camera = { zoom: 2, pan: { x: 5, y: 0 } };
  tick();
  expect(result.current).toEqual({ zoom: 2, pan: { x: 5, y: 0 } });
});

it('reads nothing and runs no frames with nothing to follow', () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  const { result } = renderHook(() => useFollowed(undefined));
  expect(result.current).toBeUndefined();
  expect(frames).toHaveLength(0);
});
