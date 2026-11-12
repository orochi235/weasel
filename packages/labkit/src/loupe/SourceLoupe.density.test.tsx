import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { makeMatchMedia } from '../../../core/src/core/device/testing/matchMedia';
import { SourceLoupe } from './SourceLoupe';

const dprDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (dprDescriptor) Object.defineProperty(window, 'devicePixelRatio', dprDescriptor);
  else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
});

test('the lens canvas follows a density change after mount', () => {
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  const media = makeMatchMedia({ '(pointer: coarse)': false, '(hover: hover)': true, '(resolution: 1dppx)': true });
  vi.stubGlobal('matchMedia', media.mm);
  const host = { current: document.createElement('div') };
  const { container } = render(
    <SourceLoupe aim={{ x: 0, y: 0 }} factor={4} diameter={40} source={() => null} hostRef={host} />,
  );
  const canvas = container.querySelector('canvas')!;
  const before = canvas.width;

  // The window moves to a 2x display: nothing about the loupe's props changes.
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
  act(() => media.fire('(resolution: 1dppx)', false));

  expect(canvas.width).toBe(before * 2);
});
