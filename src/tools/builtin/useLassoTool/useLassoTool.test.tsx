import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLassoTool } from './useLassoTool';
import type { LassoSelectAdapter } from 'core/adapters/types';

function makeAdapter(hits: string[] = []): LassoSelectAdapter & { applyOps: ReturnType<typeof vi.fn> } {
  const applyOps = vi.fn();
  return {
    hitTestLasso: () => hits,
    hitTestArea: () => [],
    getSelection: () => [],
    setSelection: () => {},
    applyOps,
  };
}

const VIEW = { x: 0, y: 0, scale: 1 };
const baseCtx = (worldX: number, worldY: number) => ({
  worldX,
  worldY,
  modifiers: { alt: false, shift: false, meta: false, ctrl: false },
  view: VIEW,
  selection: { current: [], get: () => [], set: () => {}, add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false, applyClick: () => {}, adapterMethods: {} },
  adapter: undefined,
  applyOps: () => {},
  setView: () => {},
  canvasRect: { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 } as DOMRect,
  scratch: undefined,
}) as never;

describe('useLassoTool', () => {
  it("declares id 'lasso' and keybinding { key: 'L' } by default", () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter));
    expect(result.current.id).toBe('lasso');
    expect(result.current.keybinding).toEqual({ key: 'L' });
  });

  it("keybinding override: passing keybinding: null omits it", () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter, { keybinding: null }));
    expect(result.current.keybinding).toBeUndefined();
  });

  it("custom keybinding passes through", () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter, { keybinding: { key: 'L', shift: true } }));
    expect(result.current.keybinding).toEqual({ key: 'L', shift: true });
  });

  it('drag.onStart claims the gesture', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter));
    let outcome: unknown;
    act(() => {
      outcome = result.current.drag!.onStart!({ clientX: 0, clientY: 0 } as PointerEvent, baseCtx(0, 0));
    });
    expect(outcome).toBe('claim');
  });

  it('drag end commits via applyOps when behavior emits ops (intersect-default w/ a hit)', () => {
    const adapter = makeAdapter(['a']);
    const { result } = renderHook(() => useLassoTool(adapter, { minVertexSpacing: 0 }));
    const tool = result.current;
    act(() => {
      tool.drag!.onStart!({ clientX: 0, clientY: 0 } as PointerEvent, baseCtx(0, 0));
    });
    act(() => {
      tool.drag!.onMove!({ clientX: 5, clientY: 0 } as PointerEvent, baseCtx(5, 0));
    });
    act(() => {
      tool.drag!.onMove!({ clientX: 5, clientY: 5 } as PointerEvent, baseCtx(5, 5));
    });
    act(() => {
      tool.drag!.onEnd!({ clientX: 5, clientY: 5 } as PointerEvent, baseCtx(5, 5));
    });
    expect(adapter.applyOps).toHaveBeenCalledTimes(1);
  });

  it('overlay layer is published on the Tool record', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter));
    expect(result.current.overlay).toBeTruthy();
    expect(result.current.overlay!.id).toBe('lasso-overlay');
    expect(result.current.overlay!.space).toBe('screen');
  });

  it("keyboard.onDown 'Escape' cancels mid-gesture without committing", () => {
    const adapter = makeAdapter(['a']);
    const { result } = renderHook(() => useLassoTool(adapter, { minVertexSpacing: 0 }));
    const tool = result.current;
    act(() => {
      tool.drag!.onStart!({ clientX: 0, clientY: 0 } as PointerEvent, baseCtx(0, 0));
    });
    act(() => {
      tool.drag!.onMove!({ clientX: 5, clientY: 0 } as PointerEvent, baseCtx(5, 0));
    });
    act(() => {
      tool.keyboard!.onDown!({ key: 'Escape' } as KeyboardEvent, baseCtx(5, 0));
    });
    expect(adapter.applyOps).not.toHaveBeenCalled();
  });
});
