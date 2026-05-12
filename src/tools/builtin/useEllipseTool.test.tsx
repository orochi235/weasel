import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEllipseTool } from './useEllipseTool';
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

describe('useEllipseTool', () => {
  it('declares id, keybinding, and crosshair cursor', () => {
    const { result } = renderHook(() => useEllipseTool({ create: () => null }));
    const tool: Tool<unknown> = result.current as Tool<unknown>;
    expect(tool.id).toBe('ellipse');
    expect(tool.keybinding).toEqual({ key: 'E' });
    expect(tool.cursor).toBe('crosshair');
  });

  it('commits via applyBatch with an insert op when create returns a node', () => {
    const create = vi.fn(({ x, y, width, height }) => ({
      id: 'el-1',
      pose: { x, y, width, height },
    }));
    const { result } = renderHook(() => useEllipseTool({ create }));
    const tool = result.current as Tool<null>;
    const ctx = noopCtx();

    tool.drag!.onStart!(new PointerEvent('pointerdown'), { ...ctx, worldX: 10, worldY: 10 });
    tool.drag!.onMove!(new PointerEvent('pointermove'), { ...ctx, worldX: 50, worldY: 30 });
    tool.drag!.onEnd!(new PointerEvent('pointerup'), { ...ctx, worldX: 50, worldY: 30 });

    expect(create).toHaveBeenCalledWith({ x: 10, y: 10, width: 40, height: 20 });
    expect(ctx.applyBatch).toHaveBeenCalledTimes(1);
  });

  it('exposes a presentation with label, icon, group=shape, and shortcut', () => {
    const { result } = renderHook(() => useEllipseTool({ create: () => null }));
    const tool = result.current as Tool<unknown>;
    expect(tool.presentation?.label).toBe('Ellipse');
    expect(tool.presentation?.group).toBe('shape');
    expect(tool.presentation?.icon).toBeDefined();
  });

  it('skips commit when bounds are below minBounds', () => {
    const create = vi.fn(() => ({ id: 'el', pose: { x: 0, y: 0, width: 0, height: 0 } }));
    const { result } = renderHook(() =>
      useEllipseTool({ create, minBounds: { width: 5, height: 5 } })
    );
    const tool = result.current as Tool<null>;
    const ctx = noopCtx();
    tool.drag!.onStart!(new PointerEvent('pointerdown'), { ...ctx, worldX: 0, worldY: 0 });
    tool.drag!.onMove!(new PointerEvent('pointermove'), { ...ctx, worldX: 1, worldY: 1 });
    tool.drag!.onEnd!(new PointerEvent('pointerup'), { ...ctx, worldX: 1, worldY: 1 });
    expect(create).not.toHaveBeenCalled();
  });
});
