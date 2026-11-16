import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSvgBox } from './useSvgBox';

afterEach(() => { vi.unstubAllGlobals(); });

it("sizes the SVG by its own layout box when an ancestor draws it at twice its size", () => {
  let report: ResizeObserverCallback = () => {};
  vi.stubGlobal('ResizeObserver', class {
    constructor(cb: ResizeObserverCallback) { report = cb; }
    observe() {}
    disconnect() {}
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 160, height: 80 });
  const ref = { current: svg };
  const { result } = renderHook(() => useSvgBox(ref));
  const entry = { target: svg, borderBoxSize: [{ inlineSize: 80, blockSize: 40 }] } as unknown as ResizeObserverEntry;
  act(() => report([entry], {} as ResizeObserver));
  expect(result.current).toEqual({ w: 80, h: 40 });
});
