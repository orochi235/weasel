/** The browser's cancelAnimationFrame throws "Illegal invocation" unless called with `this` as the window (or none). */
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { useVisibleRaf } from './useVisibleRaf';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Loop() {
  const loop = useVisibleRaf(() => {});
  useEffect(() => { loop.request(); }, [loop]);
  return null;
}

it('cancels its frame on unmount with the browser canceller called as Chromium requires', () => {
  const canceled: number[] = [];
  vi.stubGlobal('requestAnimationFrame', () => 7);
  vi.stubGlobal('cancelAnimationFrame', function strict(this: unknown, id: number) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    canceled.push(id);
  });
  const { unmount } = render(<Loop />);
  act(() => {});
  expect(() => unmount()).not.toThrow();
  expect(canceled).toEqual([7]);
});
