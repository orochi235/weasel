import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLineTool } from './useLineTool';
import type { Tool, ToolCtx } from '../types';

function noopCtx(
  overrides: Partial<ToolCtx<null>> & { applyBatch?: ToolCtx['applyBatch'] } = {},
): ToolCtx<null> {
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
    ...overrides,
  };
}

describe('useLineTool', () => {
  it('declares id, keybinding (\\), and presentation', () => {
    const { result } = renderHook(() => useLineTool({ create: () => null }));
    const tool: Tool<unknown> = result.current as Tool<unknown>;
    expect(tool.id).toBe('line');
    expect(tool.keybinding).toEqual({ key: '\\' });
    expect(tool.presentation?.group).toBe('shape');
    expect(tool.presentation?.label).toBe('Line');
  });

  it('commits with the start/end pair on drag end', () => {
    const create = vi.fn((a, b) => ({ id: 'l1', a, b }));
    const { result } = renderHook(() => useLineTool({ create }));
    const tool = result.current as Tool<null>;
    const ctx = noopCtx();
    ctx.worldX = 1;
    ctx.worldY = 2;
    tool.drag!.onStart!(new PointerEvent('pointerdown'), ctx);
    ctx.worldX = 10;
    ctx.worldY = 20;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);
    tool.drag!.onEnd!(new PointerEvent('pointerup'), ctx);
    expect(create).toHaveBeenCalledWith({ x: 1, y: 2 }, { x: 10, y: 20 });
    expect(ctx.applyBatch).toHaveBeenCalledTimes(1);
  });

  it('with shift, snaps end angle to 15° increments', () => {
    const create = vi.fn((a, b) => ({ id: 'l1', a, b }));
    const { result } = renderHook(() => useLineTool({ create }));
    const tool = result.current as Tool<null>;
    const ctx = noopCtx({
      modifiers: { alt: false, shift: true, meta: false, ctrl: false, space: false },
    });
    ctx.worldX = 0;
    ctx.worldY = 0;
    tool.drag!.onStart!(new PointerEvent('pointerdown'), ctx);
    // 14° from horizontal — should snap to 15°
    ctx.worldX = 100;
    ctx.worldY = 25;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);
    tool.drag!.onEnd!(new PointerEvent('pointerup'), ctx);
    const [, endPoint] = create.mock.calls[0];
    // 15° from horizontal: end ≈ (cos15° * len, sin15° * len) with len = √(100² + 25²) ≈ 103.08
    const len = Math.hypot(100, 25);
    expect(endPoint.x).toBeCloseTo(len * Math.cos(Math.PI / 12), 3);
    expect(endPoint.y).toBeCloseTo(len * Math.sin(Math.PI / 12), 3);
  });

  it('with alt, mirrors end around start', () => {
    const create = vi.fn((a, b) => ({ id: 'l1', a, b }));
    const { result } = renderHook(() => useLineTool({ create }));
    const tool = result.current as Tool<null>;
    const ctx = noopCtx({
      modifiers: { alt: true, shift: false, meta: false, ctrl: false, space: false },
    });
    ctx.worldX = 0;
    ctx.worldY = 0;
    tool.drag!.onStart!(new PointerEvent('pointerdown'), ctx);
    ctx.worldX = 5;
    ctx.worldY = 5;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx);
    tool.drag!.onEnd!(new PointerEvent('pointerup'), ctx);
    // alt: drag is treated as half the line — start moves to (−5,−5), end stays at (5,5)
    expect(create).toHaveBeenCalledWith({ x: -5, y: -5 }, { x: 5, y: 5 });
  });

  it('skips commit when below minLength', () => {
    const create = vi.fn(() => ({ id: 'l1' }));
    const { result } = renderHook(() => useLineTool({ create, minLength: 10 }));
    const tool = result.current as Tool<null>;
    const ctx = noopCtx();
    ctx.worldX = 0;
    ctx.worldY = 0;
    tool.drag!.onStart!(new PointerEvent('pointerdown'), ctx);
    ctx.worldX = 3;
    ctx.worldY = 4;
    tool.drag!.onMove!(new PointerEvent('pointermove'), ctx); // length 5
    tool.drag!.onEnd!(new PointerEvent('pointerup'), ctx);
    expect(create).not.toHaveBeenCalled();
  });
});
