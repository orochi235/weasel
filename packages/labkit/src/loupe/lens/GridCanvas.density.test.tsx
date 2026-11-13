import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { makeMatchMedia } from '../../../../core/src/core/device/testing/matchMedia';
import { GridCanvas } from './GridCanvas';
import type { LensSource, LensSourceRequest } from './lensSource';

const dprDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');

beforeAll(() => {
  // A 2D context that takes every call, so the grid sizes its buffer.
  const ctx = new Proxy({}, { get: () => () => {} });
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ctx,
  ) as unknown as HTMLCanvasElement['getContext'];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (dprDescriptor) Object.defineProperty(window, 'devicePixelRatio', dprDescriptor);
  else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
});

const source: LensSource<null> = {
  kind: 'pixels',
  produces: 'pixels',
  label: () => 'Pixels',
  status: () => true,
  subscribe: () => () => {},
  attach: () => ({ update() {}, detach() {} }),
  capture: () => new Promise(() => {}),
};

const request: LensSourceRequest<null> = {
  lensId: 'a',
  reticle: { x: 0, y: 0 },
  factor: 4,
  size: { width: 50, height: 40 },
  conditions: null,
  dpr: 1,
};

test("the grid's buffer follows the display's density after mount", () => {
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  const media = makeMatchMedia({
    '(pointer: coarse)': false,
    '(hover: hover)': true,
    '(resolution: 1dppx)': true,
  });
  vi.stubGlobal('matchMedia', media.mm);
  const { container } = render(<GridCanvas source={source} request={request} />);
  const canvas = container.querySelector('canvas');
  if (!canvas) throw new Error('no grid canvas');
  expect(canvas.width).toBe(50);

  // The window moves to a 2x display; nothing about the lens changes.
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
  act(() => media.fire('(resolution: 1dppx)', false));

  expect(canvas.width).toBe(100);
});
