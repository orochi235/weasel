import { act, cleanup, render } from '@testing-library/react';
import type { View } from '@weasel-js/core';
import { afterEach, expect, it, vi } from 'vitest';
import type { CameraContextValue } from '../canvas/CameraInput';
import { LoupePainter } from './LoupePainter';
import { type LoupeRenderArgs, resolveLoupe } from './types';

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

it('redraws a render lens when the camera it falls back to pans under a still aim', () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  let at: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
  const camera = {
    view: { get: () => at, set: () => {} },
    frame: { originPx: { x: 0, y: 0 }, yDir: 1 },
    element: () => null,
  } as unknown as CameraContextValue;
  const seen: LoupeRenderArgs[] = [];
  const options = resolveLoupe({
    render: (args) => {
      seen.push(args);
      return null;
    },
  });
  render(
    <LoupePainter
      options={options}
      shows={{ x: 10, y: 10 }}
      shownFactor={2}
      box={{ width: 40, height: 40 }}
      mode="vector"
      size={{ width: 100, height: 100 }}
      view={undefined}
      stack={null}
      camera={camera}
      host={{ current: null }}
      surface={undefined}
    />,
  );
  tick();
  const before = seen.at(-1)?.view;
  at = { x: 50, y: 0, scale: { x: 1, y: 1 } };
  tick();
  expect(seen.at(-1)?.view).not.toEqual(before);
});
