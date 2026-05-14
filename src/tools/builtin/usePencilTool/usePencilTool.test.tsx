import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePencilTool } from './usePencilTool';
import type { Tool, ToolCtx } from '../../types';
import type { PolygonPath } from 'features/paths/types';

function noopCtx(): ToolCtx<unknown> {
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
    applyOps: vi.fn(),
    scratch: null,
  };
}

describe('usePencilTool', () => {
  it('declares id, keybinding (N), and presentation', () => {
    const { result } = renderHook(() => usePencilTool({ create: () => null }));
    const tool = result.current as Tool<unknown>;
    expect(tool.id).toBe('pencil');
    expect(tool.keybinding).toEqual({ key: 'N' });
    expect(tool.presentation?.label).toBe('Pencil');
    expect(tool.presentation?.group).toBe('draw');
  });

  it('commits a polygon path with cubic segments from the captured stream', () => {
    const create = vi.fn((path: PolygonPath, opts: { closed: boolean }) => ({
      id: 'pe1', path, closed: opts.closed,
    }));
    const { result } = renderHook(() => usePencilTool({ create, tolerance: 1 }));
    const tool = result.current as Tool<unknown>;
    const ctx = noopCtx();
    ctx.worldX = 100; ctx.worldY = 0;
    tool.drag!.onStart!(new PointerEvent('pointerdown'), ctx);
    for (let i = 1; i <= 16; i++) {
      const t = (i / 16) * (Math.PI / 2);
      ctx.worldX = 100 * Math.cos(t);
      ctx.worldY = 100 * Math.sin(t);
      tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);
    }
    ctx.worldX = 0; ctx.worldY = 100;
    tool.drag!.onEnd!(new PointerEvent('pointerup'), ctx);

    expect(create).toHaveBeenCalledTimes(1);
    const [path, opts] = create.mock.calls[0];
    expect(path.kind).toBe('polygon');
    // First sample → moveTo at (100, 0)
    expect(path.coords[0]).toBeCloseTo(100);
    expect(opts.closed).toBe(false);
  });

  it('marks path as closed when start and end are within closeThreshold', () => {
    const create = vi.fn((_p, opts: { closed: boolean }) => ({ id: 'pe', closed: opts.closed }));
    const { result } = renderHook(() => usePencilTool({ create, closeThreshold: 5 }));
    const tool = result.current as Tool<unknown>;
    const ctx = noopCtx();
    ctx.worldX = 0; ctx.worldY = 0;
    tool.drag!.onStart!(new PointerEvent('pointerdown'), ctx);
    ctx.worldX = 50; ctx.worldY = 0;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);
    ctx.worldX = 50; ctx.worldY = 50;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);
    ctx.worldX = 2; ctx.worldY = 2;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);
    tool.drag!.onEnd!(new PointerEvent('pointerup'), ctx);
    expect(create.mock.calls[0][1].closed).toBe(true);
  });

  it('cancel discards captured samples without invoking create', () => {
    const create = vi.fn(() => ({ id: 'pe' }));
    const { result } = renderHook(() => usePencilTool({ create }));
    const tool = result.current as Tool<unknown>;
    const ctx = noopCtx();
    ctx.worldX = 0; ctx.worldY = 0;
    tool.drag!.onStart!(new PointerEvent('pointerdown'), ctx);
    ctx.worldX = 10; ctx.worldY = 10;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);
    tool.drag!.onCancel!(ctx);
    expect(create).not.toHaveBeenCalled();
  });
});
