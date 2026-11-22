import { renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { CanvasStackSurface } from '../canvas/CanvasStackContext';
import { useLoupeSampling } from './TrialLoupe';

const surface = (timed: boolean, ticks: CanvasStackSurface['ticks']): CanvasStackSurface => ({
  element: { current: null },
  size: { width: 10, height: 10, dpr: 1 },
  canvases: { current: new Map() },
  layers: [{ id: 'a', render: () => {}, timed }] as unknown as CanvasStackSurface['layers'],
  ticks,
});

test('a lens over a stack with timed layers resamples on every stack tick', () => {
  const ticks = vi.fn(() => () => {});
  const host = { current: null };
  const { result } = renderHook(() => useLoupeSampling(surface(true, ticks), undefined, host));
  const fn = () => {};
  result.current.subscribeResample?.(fn);
  expect(ticks).toHaveBeenCalledWith(fn);
});

test('a lens over a still stack has nothing to resample on', () => {
  const ticks = vi.fn(() => () => {});
  const host = { current: null };
  const { result } = renderHook(() => useLoupeSampling(surface(false, ticks), undefined, host));
  expect(result.current.subscribeResample).toBeUndefined();
});
