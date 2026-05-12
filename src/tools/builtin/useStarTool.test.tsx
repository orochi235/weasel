import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStarTool } from './useStarTool';
import type { Tool, ToolCtx } from '../types';

function noopCtx(): ToolCtx<null> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: {
      get: () => [], set: () => {}, add: () => {}, remove: () => {},
      toggle: () => {}, clear: () => {}, applyClick: () => {},
    } as never,
    adapter: null,
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    applyBatch: vi.fn(),
    scratch: null,
  };
}

describe('useStarTool', () => {
  it('declares id and presentation (no default keybinding)', () => {
    const { result } = renderHook(() => useStarTool({ create: () => null }));
    const tool = result.current as Tool<unknown>;
    expect(tool.id).toBe('star');
    expect(tool.keybinding).toBeUndefined();
    expect(tool.presentation?.label).toBe('Star');
    expect(tool.presentation?.group).toBe('shape');
  });

  it('commits with center / outer / inner / rotation / points', () => {
    const create = vi.fn((center, outer, inner, rotation, points) => ({
      id: 's1', center, outer, inner, rotation, points,
    }));
    const { result } = renderHook(() => useStarTool({ create, points: 5, innerRatio: 0.5 }));
    const tool = result.current as Tool<null>;
    const ctx = noopCtx();
    ctx.worldX = 0; ctx.worldY = 0;
    tool.drag!.onStart!(new PointerEvent('pointerdown'), ctx);
    ctx.worldX = 100; ctx.worldY = 0;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);
    tool.drag!.onEnd!(new PointerEvent('pointerup'), ctx);
    expect(create).toHaveBeenCalledWith(
      { x: 0, y: 0 }, 100, 50, 0, 5,
    );
  });

  it('skips commit when radius is below minRadius', () => {
    const create = vi.fn(() => ({ id: 's' }));
    const { result } = renderHook(() => useStarTool({ create, minRadius: 10 }));
    const tool = result.current as Tool<null>;
    const ctx = noopCtx();
    ctx.worldX = 0; ctx.worldY = 0;
    tool.drag!.onStart!(new PointerEvent('pointerdown'), ctx);
    ctx.worldX = 3; ctx.worldY = 4;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);
    tool.drag!.onEnd!(new PointerEvent('pointerup'), ctx);
    expect(create).not.toHaveBeenCalled();
  });
});
