import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWheelPanTool } from './useWheelPanTool';
import type { ToolCtx } from '../types';
import type { View } from '../../features/viewport/view';

function makeCtx(view: View, setView: (v: View) => void): ToolCtx<null> {
  return {
    worldX: 0, worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: {} as never,
    adapter: null,
    applyBatch: () => {},
    view, setView,
    canvasRect: new DOMRect(),
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

describe('useWheelPanTool', () => {
  it('passes when ctrlKey is true (lets wheel-zoom claim)', () => {
    const { result } = renderHook(() => useWheelPanTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: 1 }, setView);
    const e = wheel({ deltaX: 10, deltaY: 5, ctrlKey: true });
    expect(result.current.wheel!.onWheel!(e, ctx)).toBe('pass');
    expect(setView).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('translates by (deltaX/scale, deltaY/scale) under scale=1', () => {
    const { result } = renderHook(() => useWheelPanTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: 1 }, setView);
    const e = wheel({ deltaX: 20, deltaY: 10 });
    expect(result.current.wheel!.onWheel!(e, ctx)).toBe('claim');
    expect(setView).toHaveBeenCalledWith({ x: 20, y: 10, scale: 1 });
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('translates by (deltaX/scale, deltaY/scale) under scale=2', () => {
    const { result } = renderHook(() => useWheelPanTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 5, y: 5, scale: 2 }, setView);
    const e = wheel({ deltaX: 20, deltaY: 10 });
    result.current.wheel!.onWheel!(e, ctx);
    expect(setView).toHaveBeenCalledWith({ x: 5 + 10, y: 5 + 5, scale: 2 });
  });

  it('preserves scale', () => {
    const { result } = renderHook(() => useWheelPanTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: 3 }, setView);
    result.current.wheel!.onWheel!(wheel({ deltaX: 0, deltaY: 0 }), ctx);
    expect((setView.mock.calls[0][0] as View).scale).toBe(3);
  });
});
