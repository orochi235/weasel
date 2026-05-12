import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewAnimation } from './useViewAnimation';
import type { View } from './view';

describe('useViewAnimation', () => {
  it('returns animateTo, animateToBounds, and cancel', () => {
    const { result } = renderHook(() => useViewAnimation(vi.fn()));
    expect(typeof result.current.animateTo).toBe('function');
    expect(typeof result.current.animateToBounds).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
  });

  it('animateTo calls setView', () => {
    const setView = vi.fn();
    let fired = false;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => { if (!fired) { fired = true; cb(0); } return 1; });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    const { result } = renderHook(() => useViewAnimation(setView));
    result.current.animateTo({ x: 0, y: 0, scale: 1 }, { x: 10, y: 0, scale: 1 });
    expect(setView).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('useViewAnimation.animateToBounds', () => {
  let rafCallbacks: Array<(t: number) => void> = [];
  let rafTime = 0;
  function stepRAF(dt = 16) {
    rafTime += dt;
    const cbs = rafCallbacks.splice(0);
    for (const cb of cbs) cb(rafTime);
  }
  beforeEach(() => {
    rafCallbacks = []; rafTime = 0;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => { rafCallbacks.push(cb); return rafCallbacks.length; });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('tweens current view to the fitted view for the bounds', () => {
    const setView = vi.fn();
    const { result } = renderHook(() => useViewAnimation(setView));
    const current: View = { x: 0, y: 0, scale: 1 };
    act(() => {
      result.current.animateToBounds(
        { x: 0, y: 0, width: 100, height: 100 },
        current,
        { width: 200, height: 200 },
        { padding: 0, duration: 100 },
      );
    });
    // Run to completion.
    act(() => { stepRAF(0); stepRAF(100); });
    const last = setView.mock.calls[setView.mock.calls.length - 1][0] as View;
    // Expected: scale 2, view (0, 0)
    expect(last.scale).toBeCloseTo(2);
    expect(last.x).toBeCloseTo(0);
    expect(last.y).toBeCloseTo(0);
  });

  it('no-ops for zero-area bounds (does not call setView)', () => {
    const setView = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useViewAnimation(setView));
    act(() => {
      result.current.animateToBounds(
        { x: 0, y: 0, width: 0, height: 100 },
        { x: 0, y: 0, scale: 1 },
        { width: 200, height: 200 },
      );
    });
    act(() => { stepRAF(0); stepRAF(250); });
    expect(setView).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('forwards duration and easing to the underlying tween', () => {
    const setView = vi.fn();
    const easing = vi.fn((t: number) => t);
    const { result } = renderHook(() => useViewAnimation(setView));
    act(() => {
      result.current.animateToBounds(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 0, y: 0, scale: 1 },
        { width: 200, height: 200 },
        { padding: 0, duration: 200, easing },
      );
    });
    act(() => { stepRAF(0); stepRAF(100); stepRAF(100); });
    expect(easing).toHaveBeenCalled();
  });
});
