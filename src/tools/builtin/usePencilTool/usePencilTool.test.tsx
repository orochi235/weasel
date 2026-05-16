import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePencilTool, type PencilPoint } from './usePencilTool';
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

  it('captures pressure / tilt onto each PencilPoint from the PointerEvent', () => {
    const { result } = renderHook(() => usePencilTool({ create: () => null }));
    const tool = result.current as Tool<unknown>;
    const ctx = noopCtx() as ToolCtx<unknown> & { scratch: { samples: Array<{ x: number; y: number; pressure?: number; tiltX?: number; tiltY?: number }> } | null };
    const stylusEvent = (clientX: number, clientY: number, pressure: number, tiltX = 0, tiltY = 0): PointerEvent => ({
      clientX, clientY, pressure, tiltX, tiltY, pointerType: 'pen', twist: 0,
    } as unknown as PointerEvent);
    ctx.worldX = 10; ctx.worldY = 0;
    tool.drag!.onStart!(stylusEvent(10, 0, 0.0), ctx);
    // After onStart the dispatcher installs ctx.scratch = { samples: [...] }
    expect(ctx.scratch).not.toBeNull();
    const samples = ctx.scratch!.samples;
    expect(samples).toHaveLength(1);
    expect(samples[0].pressure).toBeUndefined(); // first sample (onStart) has no event-derived pressure

    ctx.worldX = 20; ctx.worldY = 0;
    tool.drag!.onMove!(stylusEvent(20, 0, 0.42, 5, -3), ctx);
    expect(samples).toHaveLength(2);
    expect(samples[1]).toMatchObject({ x: 20, y: 0, pressure: 0.42, tiltX: 5, tiltY: -3 });

    ctx.worldX = 30; ctx.worldY = 0;
    tool.drag!.onMove!(stylusEvent(30, 0, 0.7, -8, 2), ctx);
    expect(samples).toHaveLength(3);
    expect(samples[2]).toMatchObject({ x: 30, y: 0, pressure: 0.7, tiltX: -8, tiltY: 2 });
  });

  it('pressureToWidth: stamps width on each sample and forwards a widths array to create', () => {
    let received: { closed: boolean; widths?: number[] } | null = null;
    const create = (_path: PolygonPath, opts: { closed: boolean; widths?: number[] }) => {
      received = opts;
      return { id: 'pe1' };
    };
    const { result } = renderHook(() =>
      usePencilTool({
        create,
        tolerance: 1,
        // Width = pressure × 10 — linear and predictable for assertions.
        pressureToWidth: (s) => (s.pressure ?? 0) * 10,
      }),
    );
    const tool = result.current as Tool<unknown>;
    const ctx = noopCtx() as ToolCtx<unknown> & { scratch: { samples: PencilPoint[] } | null };
    const stylusEvent = (clientX: number, clientY: number, pressure: number): PointerEvent => ({
      clientX, clientY, pressure, tiltX: 0, tiltY: 0, pointerType: 'pen', twist: 0,
    } as unknown as PointerEvent);
    ctx.worldX = 0; ctx.worldY = 0;
    tool.drag!.onStart!(stylusEvent(0, 0, 0), ctx);
    for (let i = 1; i <= 8; i++) {
      ctx.worldX = i * 10;
      ctx.worldY = 0;
      tool.drag!.onMove!(stylusEvent(i * 10, 0, i / 10), ctx);
    }
    tool.drag!.onEnd!(stylusEvent(80, 0, 0.8), ctx);

    expect(received).not.toBeNull();
    expect(received!.widths).toBeDefined();
    expect(received!.widths!.length).toBeGreaterThan(0);
    // First anchor sits at the first sample (pressure 0 → width 0).
    expect(received!.widths![0]).toBeCloseTo(0);
    // Last anchor sits at the last sample (pressure 0.8 → width 8).
    expect(received!.widths![received!.widths!.length - 1]).toBeCloseTo(8);
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
