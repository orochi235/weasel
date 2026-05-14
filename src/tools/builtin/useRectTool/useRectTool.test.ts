import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRectTool } from './useRectTool';
import type { ToolCtx } from '../../types';

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
    // Declarative routing factory always emits cursor as a function
    // (resolveCursor closure). Invoke it to compare the resolved value.
    const cursor = typeof result.current.cursor === 'function'
      ? (result.current.cursor as (c: ToolCtx<null>) => string)(makeCtx())
      : result.current.cursor;
    expect(cursor).toBe('crosshair');
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

  it('applies snapPoint to both start and current so committed bounds land on grid', () => {
    const applyOps = vi.fn();
    const create = vi.fn().mockReturnValue({ id: 'a' });
    // Snap function rounds to the nearest 10.
    const snapPoint = (p: { x: number; y: number }) => ({
      x: Math.round(p.x / 10) * 10,
      y: Math.round(p.y / 10) * 10,
    });
    const { result } = renderHook(() => useRectTool({ create, snapPoint }));
    const ctx = makeCtx({ applyOps });

    // Off-grid drag: start (3, 7) snaps to (0, 10); end (58, 44) snaps to (60, 40).
    // Bounds become x=0, y=10, w=60, h=30 — all on 10s.
    drag(result.current, { worldX: 3, worldY: 7 }, { worldX: 58, worldY: 44 }, ctx);

    expect(create).toHaveBeenCalledWith({ x: 0, y: 10, width: 60, height: 30 });
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
