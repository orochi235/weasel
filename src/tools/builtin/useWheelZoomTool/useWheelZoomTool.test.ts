import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWheelZoomTool } from './useWheelZoomTool';
import type { ToolCtx } from '../../types';
import type { View } from 'core/viewport/view';

function makeCtx(view: View, setView: (v: View) => void, rect: Partial<DOMRect> = {}): ToolCtx<null> {
  const r = new DOMRect(rect.x ?? 0, rect.y ?? 0, rect.width ?? 200, rect.height ?? 200);
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: {} as never,
    adapter: null,
    applyOps: () => {},
    view,
    setView,
    canvasRect: r,
    scratch: null,
  };
}

function wheel(init: Partial<WheelEventInit> & { ctrlKey?: boolean }): WheelEvent {
  const e = new Event('wheel') as WheelEvent;
  Object.assign(e, {
    deltaX: 0, deltaY: 0, deltaZ: 0, deltaMode: 0,
    clientX: 0, clientY: 0,
    ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
    preventDefault: vi.fn(),
    ...init,
  });
  return e;
}

describe('useWheelZoomTool', () => {
  it('passes when ctrlKey is false', () => {
    const { result } = renderHook(() => useWheelZoomTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    const e = wheel({ deltaY: -100, ctrlKey: false });
    const decision = result.current.wheel!.onWheel!(e, ctx);
    expect(decision).toBe('pass');
    expect(setView).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('zooms about cursor anchor when ctrlKey is true', () => {
    const { result } = renderHook(() => useWheelZoomTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    const e = wheel({ deltaY: -100, ctrlKey: true, clientX: 100, clientY: 50 });
    const decision = result.current.wheel!.onWheel!(e, ctx);
    expect(decision).toBe('claim');
    expect(setView).toHaveBeenCalledTimes(1);
    const next = setView.mock.calls[0][0] as View;
    // wheelStep=1.1, factor = 1.1^(100/100) = 1.1
    expect(next.scale.x).toBeCloseTo(1.1);
    expect(next.scale.y).toBeCloseTo(1.1);
    // The world point under (100,50) screen must be invariant: was (100, 50) at scale=1
    expect(100 / next.scale.x + next.x).toBeCloseTo(100);
    expect(50 / next.scale.y + next.y).toBeCloseTo(50);
  });

  it('respects min/max from opts', () => {
    const { result } = renderHook(() => useWheelZoomTool({ min: 0.5, max: 2 }));
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    // huge zoom-in
    result.current.wheel!.onWheel!(wheel({ deltaY: -10000, ctrlKey: true }), ctx);
    expect((setView.mock.calls[0][0] as View).scale.x).toBe(2);
    expect((setView.mock.calls[0][0] as View).scale.y).toBe(2);
    // huge zoom-out
    result.current.wheel!.onWheel!(wheel({ deltaY: 10000, ctrlKey: true }), ctx);
    expect((setView.mock.calls[1][0] as View).scale.x).toBe(0.5);
    expect((setView.mock.calls[1][0] as View).scale.y).toBe(0.5);
  });

  it('calls preventDefault on claim', () => {
    const { result } = renderHook(() => useWheelZoomTool());
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, vi.fn());
    const e = wheel({ deltaY: -100, ctrlKey: true });
    result.current.wheel!.onWheel!(e, ctx);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('subtracts canvasRect.left/top from clientX/clientY for the anchor', () => {
    const { result } = renderHook(() => useWheelZoomTool());
    const setView = vi.fn();
    const ctx = makeCtx(
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
      setView,
      { x: 50, y: 25, width: 200, height: 200 } as Partial<DOMRect>,
    );
    const e = wheel({ deltaY: -100, ctrlKey: true, clientX: 150, clientY: 75 });
    result.current.wheel!.onWheel!(e, ctx);
    const next = setView.mock.calls[0][0] as View;
    // anchor in canvas coords: (150-50, 75-25) = (100, 50)
    expect(100 / next.scale.x + next.x).toBeCloseTo(100);
    expect(50 / next.scale.y + next.y).toBeCloseTo(50);
  });
});

describe('useWheelZoomTool — axis option', () => {
  it("axis: 'x' only changes scale.x (scale.y unchanged)", () => {
    const { result } = renderHook(() => useWheelZoomTool({ axis: 'x' }));
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    const e = wheel({ deltaY: -100, ctrlKey: true, clientX: 100, clientY: 50 });
    result.current.wheel!.onWheel!(e, ctx);
    expect(setView).toHaveBeenCalledTimes(1);
    const next = setView.mock.calls[0][0] as View;
    expect(next.scale.x).toBeCloseTo(1.1);
    expect(next.scale.y).toBe(1);
  });

  it("axis: 'y' only changes scale.y (scale.x unchanged)", () => {
    const { result } = renderHook(() => useWheelZoomTool({ axis: 'y' }));
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    const e = wheel({ deltaY: -100, ctrlKey: true, clientX: 100, clientY: 50 });
    result.current.wheel!.onWheel!(e, ctx);
    expect(setView).toHaveBeenCalledTimes(1);
    const next = setView.mock.calls[0][0] as View;
    expect(next.scale.x).toBe(1);
    expect(next.scale.y).toBeCloseTo(1.1);
  });

  it("axis: 'both' (default) zooms both axes uniformly", () => {
    const { result } = renderHook(() => useWheelZoomTool({ axis: 'both' }));
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    const e = wheel({ deltaY: -100, ctrlKey: true, clientX: 100, clientY: 50 });
    result.current.wheel!.onWheel!(e, ctx);
    expect(setView).toHaveBeenCalledTimes(1);
    const next = setView.mock.calls[0][0] as View;
    expect(next.scale.x).toBeCloseTo(1.1);
    expect(next.scale.y).toBeCloseTo(1.1);
    expect(next.scale.x).toBe(next.scale.y);
  });
});
