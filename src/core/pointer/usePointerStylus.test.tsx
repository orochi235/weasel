import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePointerStylus } from './usePointerStylus';

function dispatchMove(target: EventTarget, init: Partial<PointerEvent>) {
  const e = new Event('pointermove', { bubbles: true });
  Object.assign(e, {
    pressure: 0.5,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 'mouse',
    clientX: 0,
    clientY: 0,
    ...init,
  });
  target.dispatchEvent(e);
}

describe('usePointerStylus', () => {
  it('reports the latest pen pressure on pointermove', () => {
    const { result } = renderHook(() => usePointerStylus(undefined, { maxFps: Infinity }));
    expect(result.current.pressure).toBe(0);
    act(() => {
      dispatchMove(window, { pointerType: 'pen', pressure: 0.6, tiltX: -5 });
    });
    expect(result.current.pressure).toBeCloseTo(0.6);
    expect(result.current.tiltX).toBe(-5);
    expect(result.current.isStylus).toBe(true);
    expect(result.current.pointerType).toBe('pen');
  });

  it('throttles updates by maxFps', () => {
    const { result } = renderHook(() => usePointerStylus(undefined, { maxFps: 30 }));
    act(() => {
      dispatchMove(window, { pointerType: 'pen', pressure: 0.1 });
    });
    const after1 = result.current.pressure;
    expect(after1).toBeCloseTo(0.1);
    // A second move immediately after should be dropped (< 1/30s gap).
    act(() => {
      dispatchMove(window, { pointerType: 'pen', pressure: 0.9 });
    });
    expect(result.current.pressure).toBeCloseTo(0.1); // unchanged
  });

  it('stylusOnly: ignores non-pen events', () => {
    const { result } = renderHook(() => usePointerStylus(undefined, { maxFps: Infinity, stylusOnly: true }));
    act(() => {
      dispatchMove(window, { pointerType: 'mouse', pressure: 0.8 });
    });
    expect(result.current.pressure).toBe(0);
    act(() => {
      dispatchMove(window, { pointerType: 'pen', pressure: 0.4 });
    });
    expect(result.current.pressure).toBeCloseTo(0.4);
  });

  it('tracks hover via pointerenter / pointerleave', () => {
    const { result } = renderHook(() => usePointerStylus(undefined, { maxFps: Infinity }));
    expect(result.current.hovering).toBe(false);
    act(() => {
      const e = new Event('pointerenter', { bubbles: true });
      Object.assign(e, { pointerType: 'pen' });
      window.dispatchEvent(e);
    });
    expect(result.current.hovering).toBe(true);
    act(() => {
      const e = new Event('pointerleave', { bubbles: true });
      Object.assign(e, { pointerType: 'pen' });
      window.dispatchEvent(e);
    });
    expect(result.current.hovering).toBe(false);
  });
});
