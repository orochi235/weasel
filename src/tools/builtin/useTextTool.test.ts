import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTextTool } from './useTextTool';
import type { ToolCtx } from '../types';

function makeCtx(over: Partial<ToolCtx<undefined>> = {}): ToolCtx<undefined> {
  return {
    worldX: 100,
    worldY: 200,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [], applyClick: vi.fn() } as unknown as ToolCtx['selection'],
    adapter: {},
    applyBatch: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: undefined,
    ...over,
  };
}

function pe(): PointerEvent {
  const e = new Event('click') as PointerEvent;
  Object.assign(e, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
  return e;
}

describe('useTextTool', () => {
  it('declares id "text", T keybinding, text cursor', () => {
    const { result } = renderHook(() =>
      useTextTool({ commitInsert: () => ({ id: 'x', x: 0, y: 0, width: 0, height: 0, text: '' }) }),
    );
    expect(result.current.id).toBe('text');
    expect(result.current.keybinding).toBe('T');
    expect(result.current.cursor).toBe('text');
  });

  it('pointer.onClick calls commitInsert with the click point and dispatches an InsertOp via applyBatch', () => {
    const commitInsert = vi.fn((p: { worldX: number; worldY: number }) => ({
      id: 't1',
      x: p.worldX,
      y: p.worldY,
      width: 120,
      height: 32,
      text: '',
    }));
    const applyBatch = vi.fn();
    const { result } = renderHook(() => useTextTool({ commitInsert }));
    const decision = result.current.pointer!.onClick!(pe(), makeCtx({ worldX: 50, worldY: 75, applyBatch }));
    expect(decision).toBe('claim');
    expect(commitInsert).toHaveBeenCalledWith({ worldX: 50, worldY: 75 });
    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [ops, label] = applyBatch.mock.calls[0] as [Array<{ apply: unknown; invert: unknown }>, string];
    expect(label).toBe('Insert text');
    expect(ops.length).toBe(1);
    expect(typeof ops[0].invert).toBe('function');
  });

  it('pointer.onClick with commitInsert returning null is a no-op pass', () => {
    const commitInsert = vi.fn(() => null);
    const applyBatch = vi.fn();
    const { result } = renderHook(() => useTextTool({ commitInsert }));
    const decision = result.current.pointer!.onClick!(pe(), makeCtx({ applyBatch }));
    expect(decision).toBe('pass');
    expect(applyBatch).not.toHaveBeenCalled();
  });

  it('has no drag handlers when commitInsertBounds is omitted (click-only)', () => {
    const { result } = renderHook(() =>
      useTextTool({ commitInsert: () => ({ id: 'x', x: 0, y: 0, width: 0, height: 0, text: '' }) }),
    );
    expect(result.current.drag).toBeUndefined();
    expect(result.current.overlay).toBeUndefined();
  });

  it('drag-to-size: onEnd commits via commitInsertBounds when marquee meets minBounds', () => {
    const commitInsert = vi.fn();
    const commitInsertBounds = vi.fn((b: { x: number; y: number; width: number; height: number }) => ({
      id: 't1', x: b.x, y: b.y, width: b.width, height: b.height, text: '',
    }));
    const applyBatch = vi.fn();
    const { result } = renderHook(() => useTextTool({ commitInsert, commitInsertBounds }));
    const tool = result.current;

    // Drag from (10,20) to (110,80) — 100×60 box, well above the 4×4 minimum.
    const ctx = makeCtx({ applyBatch, worldX: 10, worldY: 20, scratch: { kind: 'idle' } as any });
    tool.drag!.onStart!(pe(), ctx);
    expect(ctx.scratch).toEqual({ kind: 'drag', startX: 10, startY: 20, curX: 10, curY: 20 });

    ctx.worldX = 110;
    ctx.worldY = 80;
    tool.drag!.onMove!(pe(), ctx);
    expect((ctx.scratch as any).curX).toBe(110);

    const decision = tool.drag!.onEnd!(pe(), ctx);
    expect(decision).toBe('claim');
    expect(commitInsertBounds).toHaveBeenCalledWith({ x: 10, y: 20, width: 100, height: 60 });
    expect(commitInsert).not.toHaveBeenCalled();
    expect(applyBatch).toHaveBeenCalledTimes(1);
    expect(ctx.scratch).toEqual({ kind: 'idle' });
  });

  it('drag-to-size: tiny drag falls back to commitInsert at the start point', () => {
    const commitInsert = vi.fn(() => ({ id: 't1', x: 10, y: 20, width: 0, height: 0, text: '' }));
    const commitInsertBounds = vi.fn();
    const applyBatch = vi.fn();
    const { result } = renderHook(() =>
      useTextTool({ commitInsert, commitInsertBounds, minBounds: { width: 10, height: 10 } }),
    );
    const tool = result.current;
    const ctx = makeCtx({ applyBatch, worldX: 10, worldY: 20, scratch: { kind: 'idle' } as any });
    tool.drag!.onStart!(pe(), ctx);
    ctx.worldX = 12; // 2px drag — under threshold
    ctx.worldY = 21;
    tool.drag!.onMove!(pe(), ctx);
    const decision = tool.drag!.onEnd!(pe(), ctx);
    expect(decision).toBe('claim');
    expect(commitInsertBounds).not.toHaveBeenCalled();
    expect(commitInsert).toHaveBeenCalledWith({ worldX: 10, worldY: 20 });
    expect(applyBatch).toHaveBeenCalledTimes(1);
  });

  it('drag-to-size: exposes a screen-space overlay when commitInsertBounds is supplied', () => {
    const { result } = renderHook(() =>
      useTextTool({
        commitInsert: () => null,
        commitInsertBounds: () => null,
      }),
    );
    expect(result.current.overlay).toBeDefined();
    expect(result.current.overlay!.space).toBe('screen');
  });
});
