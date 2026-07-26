import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewTween } from './useViewTween';
import type { View } from './view';

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

const from: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const to: View = { x: 100, y: 50, scale: { x: 2, y: 2 } };

describe('useViewTween', () => {
  it('does not call setView before any animateTo', () => {
    const setView = vi.fn();
    renderHook(() => useViewTween(setView));
    expect(setView).not.toHaveBeenCalled();
  });

  it('calls setView at t=0 (first frame: interpolated start)', () => {
    const setView = vi.fn();
    const { result } = renderHook(() => useViewTween(setView));
    act(() => { result.current.animateTo(from, to, { duration: 100 }); });
    act(() => { stepRAF(0); });  // first frame at t=0
    expect(setView).toHaveBeenCalled();
    const v = setView.mock.calls[0][0] as View;
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
    expect(v.scale.x).toBeCloseTo(1);
    expect(v.scale.y).toBeCloseTo(1);
  });

  it('reaches target at end of duration', () => {
    const setView = vi.fn();
    const { result } = renderHook(() => useViewTween(setView));
    act(() => { result.current.animateTo(from, to, { duration: 100 }); });
    // Step past duration
    act(() => { stepRAF(0); stepRAF(100); });
    const last = setView.mock.calls[setView.mock.calls.length - 1][0] as View;
    expect(last.x).toBeCloseTo(100);
    expect(last.y).toBeCloseTo(50);
    expect(last.scale.x).toBeCloseTo(2);
    expect(last.scale.y).toBeCloseTo(2);
  });

  it('second animateTo cancels the first', () => {
    const setView = vi.fn();
    const { result } = renderHook(() => useViewTween(setView));
    const to2: View = { x: 200, y: 0, scale: { x: 1, y: 1 } };
    act(() => { result.current.animateTo(from, to, { duration: 200 }); });
    act(() => { stepRAF(50); });
    act(() => { result.current.animateTo(from, to2, { duration: 100 }); });
    act(() => { stepRAF(0); stepRAF(100); });
    const last = setView.mock.calls[setView.mock.calls.length - 1][0] as View;
    expect(last.x).toBeCloseTo(200);
  });

  it('cancel() stops the tween mid-flight', () => {
    const setView = vi.fn();
    const { result } = renderHook(() => useViewTween(setView));
    act(() => { result.current.animateTo(from, to, { duration: 200 }); });
    act(() => { stepRAF(0); stepRAF(50); });
    const callCount = setView.mock.calls.length;
    act(() => { result.current.cancel(); stepRAF(50); });
    expect(setView).toHaveBeenCalledTimes(callCount);
  });

  it('lerps each scale axis independently', () => {
    const setView = vi.fn();
    const { result } = renderHook(() => useViewTween(setView));
    const startView: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const endView: View = { x: 0, y: 0, scale: { x: 4, y: 2 } };
    act(() => { result.current.animateTo(startView, endView, { duration: 200 }); });
    // Step to midpoint (100ms into 200ms tween)
    act(() => { stepRAF(0); stepRAF(100); });
    const mid = setView.mock.calls[setView.mock.calls.length - 1][0] as View;
    // Default easing is easeOutCubic(0.5) = 1 - (1 - 0.5)^3 = 0.875
    const t = 1 - Math.pow(1 - 0.5, 3);
    expect(mid.scale.x).toBeCloseTo(1 + (4 - 1) * t);
    expect(mid.scale.y).toBeCloseTo(1 + (2 - 1) * t);
  });
});
