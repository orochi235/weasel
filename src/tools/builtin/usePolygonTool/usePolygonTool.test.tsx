import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePolygonTool } from './usePolygonTool';
import type { Tool, ToolCtx } from '../../types';

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
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    setView: () => {},
    canvasRect: new DOMRect(),
    applyOps: vi.fn(),
    scratch: null,
  };
}

describe('usePolygonTool', () => {
  it('declares id, keybinding (G), and presentation', () => {
    const { result } = renderHook(() => usePolygonTool({ create: () => null }));
    const tool = result.current as Tool<unknown>;
    expect(tool.id).toBe('polygon');
    expect(tool.keybinding).toEqual({ key: 'G' });
    expect(tool.presentation?.label).toBe('Polygon');
    expect(tool.presentation?.group).toBe('shape');
  });

  it('commits with center / radius / rotation / sides on drag end', () => {
    const create = vi.fn((center, radius, rotation, sides) => ({
      id: 'p1', center, radius, rotation, sides,
    }));
    const { result } = renderHook(() => usePolygonTool({ create, sides: 6 }));
    const tool = result.current as Tool<null>;
    const ctx = noopCtx();

    ctx.worldX = 0; ctx.worldY = 0;
    tool.drag!.onStart!(new PointerEvent('pointerdown'), ctx);
    ctx.worldX = 10; ctx.worldY = 0;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);
    tool.drag!.onEnd!(new PointerEvent('pointerup'), ctx);

    expect(create).toHaveBeenCalledTimes(1);
    const [center, radius, rotation, sides] = create.mock.calls[0];
    expect(center).toEqual({ x: 0, y: 0 });
    expect(radius).toBeCloseTo(10);
    expect(rotation).toBeCloseTo(0);
    expect(sides).toBe(6);
  });

  it('skips commit when radius is below minRadius', () => {
    const create = vi.fn(() => ({ id: 'p' }));
    const { result } = renderHook(() => usePolygonTool({ create, minRadius: 5 }));
    const tool = result.current as Tool<null>;
    const ctx = noopCtx();

    ctx.worldX = 0; ctx.worldY = 0;
    tool.drag!.onStart!(new PointerEvent('pointerdown'), ctx);
    ctx.worldX = 2; ctx.worldY = 2;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);
    tool.drag!.onEnd!(new PointerEvent('pointerup'), ctx);

    expect(create).not.toHaveBeenCalled();
  });

  it('ArrowUp during a gesture increments sides', () => {
    const create = vi.fn((_c, _r, _rot, sides) => ({ id: 'p', sides }));
    const { result } = renderHook(() => usePolygonTool({ create, sides: 6 }));
    const tool = result.current as Tool<null>;
    const ctx = noopCtx();

    ctx.worldX = 0; ctx.worldY = 0;
    tool.drag!.onStart!(new PointerEvent('pointerdown'), ctx);
    ctx.worldX = 10; ctx.worldY = 0;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);

    tool.keyboard!.onDown!(new KeyboardEvent('keydown', { key: 'ArrowUp' }), ctx);

    tool.drag!.onEnd!(new PointerEvent('pointerup'), ctx);

    const [, , , sidesCommitted] = create.mock.calls[0];
    expect(sidesCommitted).toBe(7);
  });
});
