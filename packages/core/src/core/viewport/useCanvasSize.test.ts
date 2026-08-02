import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useCanvasSize } from './useCanvasSize';
import { makeMatchMedia } from '../device/testing/matchMedia';

beforeAll(() => {
  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    class StubRO {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof StubRO }).ResizeObserver = StubRO;
  }
});

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observed: Element[] = [];
  disconnected = false;
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    MockResizeObserver.instances.push(this);
  }
  observe(el: Element) { this.observed.push(el); }
  unobserve() {}
  disconnect() { this.disconnected = true; }
  trigger() {
    this.callback([] as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
}

describe('useCanvasSize', () => {
  it('returns initial size 0,0,1 before measurement', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useCanvasSize(ref);
    });
    // No element attached -> measurement skipped, defaults remain
    expect(result.current).toEqual({ width: 0, height: 0, dpr: 1 });
  });

  it('measures the container rect on mount and applies DPR', () => {
    const original = window.ResizeObserver;
    (window as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;
    const dprDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });

    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 600, x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, toJSON() {} }),
    });

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(el);
      return useCanvasSize(ref);
    });

    expect(result.current).toEqual({ width: 800, height: 600, dpr: 2 });

    if (dprDescriptor) Object.defineProperty(window, 'devicePixelRatio', dprDescriptor);
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = original;
  });

  it('re-measures when ResizeObserver fires', () => {
    const original = window.ResizeObserver;
    MockResizeObserver.instances = [];
    (window as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;

    let currentRect = { width: 100, height: 100 };
    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ ...currentRect, x: 0, y: 0, left: 0, top: 0, right: currentRect.width, bottom: currentRect.height, toJSON() {} }),
    });

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(el);
      return useCanvasSize(ref);
    });

    expect(result.current.width).toBe(100);
    currentRect = { width: 250, height: 175 };
    act(() => {
      MockResizeObserver.instances[MockResizeObserver.instances.length - 1].trigger();
    });
    expect(result.current.width).toBe(250);
    expect(result.current.height).toBe(175);

    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = original;
  });

  // The hole this hook had: density was only re-read inside the resize
  // callback, so dragging a window to a different-density display without
  // resizing it left `dpr` stale.
  it('picks up a density change without a resize', () => {
    const originalRO = window.ResizeObserver;
    MockResizeObserver.instances = [];
    (window as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
      MockResizeObserver;

    const dprDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });

    const h = makeMatchMedia({
      '(pointer: coarse)': false,
      '(hover: hover)': true,
      '(resolution: 1dppx)': true,
    });
    vi.stubGlobal('matchMedia', h.mm);

    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({
        width: 800, height: 600, x: 0, y: 0,
        left: 0, top: 0, right: 800, bottom: 600, toJSON() {},
      }),
    });

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(el);
      return useCanvasSize(ref);
    });

    expect(result.current).toEqual({ width: 800, height: 600, dpr: 1 });

    // Move to a 2x display. No resize happens — only the media query fires.
    const observerCallsBefore = MockResizeObserver.instances.length;
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    act(() => { h.fire('(resolution: 1dppx)', false); });

    expect(result.current).toEqual({ width: 800, height: 600, dpr: 2 });
    // Nothing re-observed: this update did not come from a resize.
    expect(MockResizeObserver.instances.length).toBe(observerCallsBefore);

    vi.unstubAllGlobals();
    if (dprDescriptor) Object.defineProperty(window, 'devicePixelRatio', dprDescriptor);
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = originalRO;
  });

  it('disconnects ResizeObserver on unmount', () => {
    const original = window.ResizeObserver;
    MockResizeObserver.instances = [];
    (window as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;

    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ width: 10, height: 10, x: 0, y: 0, left: 0, top: 0, right: 10, bottom: 10, toJSON() {} }),
    });

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(el);
      return useCanvasSize(ref);
    });
    const ro = MockResizeObserver.instances[MockResizeObserver.instances.length - 1];
    expect(ro.disconnected).toBe(false);
    unmount();
    expect(ro.disconnected).toBe(true);

    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = original;
  });
});

// Ensure unused imports are still considered touched
void vi;
