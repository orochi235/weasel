import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardZoomTool } from './useKeyboardZoomTool';
import type { ToolCtx } from '../../types';
import type { View } from 'core/viewport/view';

function makeCtx(view: View, setView: (v: View) => void, rect: Partial<DOMRect> = {}): ToolCtx<null> {
  const r = new DOMRect(rect.x ?? 0, rect.y ?? 0, rect.width ?? 200, rect.height ?? 100);
  return {
    worldX: 0, worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: {} as never,
    adapter: null,
    applyOps: () => {},
    view, setView,
    canvasRect: r,
    scratch: null,
  };
}

function key(init: Partial<KeyboardEventInit> & { key: string; metaKey?: boolean }): KeyboardEvent {
  const e = new Event('keydown') as KeyboardEvent;
  Object.assign(e, {
    key: init.key,
    metaKey: init.metaKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    shiftKey: false, altKey: false,
    preventDefault: vi.fn(),
  });
  return e;
}

describe('useKeyboardZoomTool', () => {
  it('Cmd+= zooms in about canvas center', () => {
    const { result } = renderHook(() => useKeyboardZoomTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    const decision = result.current.keyboard!.onDown!(key({ key: '=', metaKey: true }), ctx);
    expect(decision).toBe('claim');
    const next = setView.mock.calls[0][0] as View;
    // keyStep=1.25
    expect(next.scale.x).toBeCloseTo(1.25);
    expect(next.scale.y).toBeCloseTo(1.25);
    // Anchor: canvas center = (100, 50). World point under it must remain (100, 50).
    expect(100 / next.scale.x + next.x).toBeCloseTo(100);
    expect(50 / next.scale.y + next.y).toBeCloseTo(50);
  });

  it('Cmd+- zooms out about canvas center', () => {
    const { result } = renderHook(() => useKeyboardZoomTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    expect(result.current.keyboard!.onDown!(key({ key: '-', metaKey: true }), ctx)).toBe('claim');
    expect((setView.mock.calls[0][0] as View).scale.x).toBeCloseTo(1 / 1.25);
    expect((setView.mock.calls[0][0] as View).scale.y).toBeCloseTo(1 / 1.25);
  });

  it('Cmd+0 resets to identity', () => {
    const { result } = renderHook(() => useKeyboardZoomTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 50, y: 50, scale: { x: 4, y: 4 } }, setView);
    expect(result.current.keyboard!.onDown!(key({ key: '0', metaKey: true }), ctx)).toBe('claim');
    expect(setView).toHaveBeenCalledWith({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  });

  it('passes plain keys without modifier', () => {
    const { result } = renderHook(() => useKeyboardZoomTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    expect(result.current.keyboard!.onDown!(key({ key: '=' }), ctx)).toBe('pass');
    expect(setView).not.toHaveBeenCalled();
  });

  it('passes unrelated keys with modifier', () => {
    const { result } = renderHook(() => useKeyboardZoomTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    expect(result.current.keyboard!.onDown!(key({ key: 'a', metaKey: true }), ctx)).toBe('pass');
    expect(setView).not.toHaveBeenCalled();
  });

  it('ctrlKey is treated like metaKey (cross-platform)', () => {
    const { result } = renderHook(() => useKeyboardZoomTool());
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    const e = key({ key: '0' });
    Object.assign(e, { ctrlKey: true });
    expect(result.current.keyboard!.onDown!(e, ctx)).toBe('claim');
  });
});

describe('useKeyboardZoomTool — axis option', () => {
  it("axis: 'x' Cmd+= only zooms scale.x", () => {
    const { result } = renderHook(() => useKeyboardZoomTool({ axis: 'x' }));
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    expect(result.current.keyboard!.onDown!(key({ key: '=', metaKey: true }), ctx)).toBe('claim');
    const next = setView.mock.calls[0][0] as View;
    expect(next.scale.x).toBeCloseTo(1.25);
    expect(next.scale.y).toBe(1);
  });

  it("axis: 'y' Cmd+= only zooms scale.y", () => {
    const { result } = renderHook(() => useKeyboardZoomTool({ axis: 'y' }));
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    expect(result.current.keyboard!.onDown!(key({ key: '=', metaKey: true }), ctx)).toBe('claim');
    const next = setView.mock.calls[0][0] as View;
    expect(next.scale.x).toBe(1);
    expect(next.scale.y).toBeCloseTo(1.25);
  });

  it("axis: 'both' (default) Cmd+= zooms both axes uniformly", () => {
    const { result } = renderHook(() => useKeyboardZoomTool({ axis: 'both' }));
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    expect(result.current.keyboard!.onDown!(key({ key: '=', metaKey: true }), ctx)).toBe('claim');
    const next = setView.mock.calls[0][0] as View;
    expect(next.scale.x).toBeCloseTo(1.25);
    expect(next.scale.y).toBeCloseTo(1.25);
    expect(next.scale.x).toBe(next.scale.y);
  });

  it("axis: 'x' Cmd+- only zooms scale.x out", () => {
    const { result } = renderHook(() => useKeyboardZoomTool({ axis: 'x' }));
    const setView = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    expect(result.current.keyboard!.onDown!(key({ key: '-', metaKey: true }), ctx)).toBe('claim');
    const next = setView.mock.calls[0][0] as View;
    expect(next.scale.x).toBeCloseTo(1 / 1.25);
    expect(next.scale.y).toBe(1);
  });

  it("Cmd+0 reset always sets scale to { x: 1, y: 1 } regardless of axis", () => {
    const { result } = renderHook(() => useKeyboardZoomTool({ axis: 'x' }));
    const setView = vi.fn();
    const ctx = makeCtx({ x: 50, y: 50, scale: { x: 4, y: 2 } }, setView);
    expect(result.current.keyboard!.onDown!(key({ key: '0', metaKey: true }), ctx)).toBe('claim');
    expect(setView).toHaveBeenCalledWith({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  });
});

describe('useKeyboardZoomTool with animate:true', () => {
  it('does not call setView immediately when animate is true', () => {
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0);
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});

    const { result } = renderHook(() => useKeyboardZoomTool({ animate: true }));
    const setView = vi.fn();
    // Use the same makeCtx helper from the describe above
    const ctx = makeCtx({ x: 0, y: 0, scale: { x: 1, y: 1 } }, setView);
    const e = new Event('keydown') as KeyboardEvent;
    Object.assign(e, {
      key: '=',
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    });
    result.current.keyboard!.onDown!(e, ctx);
    // setView should NOT have been called synchronously — the tween defers it
    expect(setView).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
