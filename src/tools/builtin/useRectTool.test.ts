import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRectTool } from './useRectTool';
import type { ToolCtx } from '../types';

function fakeEvent(): PointerEvent {
  const e = new Event('pointermove') as PointerEvent;
  Object.assign(e, { clientX: 0, clientY: 0 });
  return e;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(overrides: Partial<ToolCtx<any>> = {}): ToolCtx<null> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: {} as never,
    adapter: null,
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: vi.fn(),
    canvasRect: new DOMRect(),
    scratch: null,
    ...overrides,
  };
}

function drag(
  tool: ReturnType<typeof useRectTool>,
  start: { worldX: number; worldY: number },
  end: { worldX: number; worldY: number },
  ctx: ToolCtx<null>,
) {
  tool.drag!.onStart!(fakeEvent(), { ...ctx, worldX: start.worldX, worldY: start.worldY });
  tool.drag!.onMove!(fakeEvent(), { ...ctx, worldX: end.worldX, worldY: end.worldY });
  tool.drag!.onEnd!(fakeEvent(), ctx);
}

describe('useRectTool', () => {
  it('has id rect and keybinding R', () => {
    const { result } = renderHook(() => useRectTool({ create: () => null }));
    expect(result.current.id).toBe('rect');
    expect(result.current.keybinding).toEqual({ key: 'R' });
    expect(result.current.cursor).toBe('crosshair');
  });

  it('calls applyOps with createInsertOp on commit', () => {
    const applyOps = vi.fn();
    const obj = { id: 'a', x: 10, y: 20, width: 50, height: 30 };
    const create = vi.fn().mockReturnValue(obj);
    const { result } = renderHook(() => useRectTool({ create }));
    const ctx = makeCtx({ applyOps });

    drag(result.current, { worldX: 10, worldY: 20 }, { worldX: 60, worldY: 50 }, ctx);

    expect(create).toHaveBeenCalledWith({ x: 10, y: 20, width: 50, height: 30 });
    expect(applyOps).toHaveBeenCalledOnce();
    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Insert rectangle');
    expect(ops).toHaveLength(1);
  });

  it('does not call applyOps when create returns null', () => {
    const applyOps = vi.fn();
    const { result } = renderHook(() => useRectTool({ create: () => null }));
    const ctx = makeCtx({ applyOps });

    drag(result.current, { worldX: 0, worldY: 0 }, { worldX: 50, worldY: 50 }, ctx);

    expect(applyOps).not.toHaveBeenCalled();
  });

  it('uses custom label when provided', () => {
    const applyOps = vi.fn();
    const { result } = renderHook(() =>
      useRectTool({ create: () => ({ id: 'x' }), label: 'Add shape' }),
    );
    drag(result.current, { worldX: 0, worldY: 0 }, { worldX: 40, worldY: 40 }, makeCtx({ applyOps }));
    expect(applyOps).toHaveBeenCalledWith(expect.any(Array), 'Add shape');
  });

  it('overlay is screen-space', () => {
    const { result } = renderHook(() => useRectTool({ create: () => null }));
    expect(result.current.overlay?.space).toBe('screen');
  });

  it('onCancel does not call applyOps', () => {
    const applyOps = vi.fn();
    const { result } = renderHook(() => useRectTool({ create: () => ({ id: 'x' }) }));
    const ctx = makeCtx({ applyOps });
    result.current.drag!.onStart!(fakeEvent(), { ...ctx, worldX: 0, worldY: 0 });
    result.current.drag!.onCancel!(ctx);
    expect(applyOps).not.toHaveBeenCalled();
  });
});
