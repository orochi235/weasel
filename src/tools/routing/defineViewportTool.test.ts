import { describe, it, expect, vi } from 'vitest';
import { defineViewportTool } from './defineViewportTool';
import { begin, hold, cancel } from './result';

const noMods = { mod: false, shift: false, alt: false, ctrl: false, meta: false, space: false };

function buildCtx(overrides: Record<string, unknown> = {}) {
  return {
    worldX: 0, worldY: 0,
    point: { x: 0, y: 0 },
    modifiers: noMods,
    selection: { current: [] },
    adapter: null,
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: vi.fn(),
    canvasRect: { left: 0, top: 0, width: 100, height: 100 } as DOMRect,
    target: { category: 'empty' as const, kind: 'empty' as const },
    scratch: null,
    ...overrides,
  };
}

describe('defineViewportTool', () => {
  it('produces a Tool with id', () => {
    const tool = defineViewportTool({
      id: 'hand',
      initial: {},
    });
    expect(tool.id).toBe('hand');
  });

  it('function-form drag fires on pointerdown', () => {
    const tool = defineViewportTool<{ x: number }>({
      id: 'hand',
      initial: {
        drag: (ctx) => begin({
          scratch: { x: (ctx as unknown as { point: { x: number } }).point.x },
          onMove: (ctx) => hold({ x: (ctx as unknown as { point: { x: number } }).point.x + 1 }),
          onRelease: cancel,
        }),
      },
    });
    const ctx = buildCtx({ point: { x: 5, y: 0 } });
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    expect((ctx as { scratch: unknown }).scratch).toEqual({ x: 5 });
  });

  it('cursor resolution works with phase override', () => {
    const tool = defineViewportTool<{ x: number }>({
      id: 'hand',
      cursor: 'grab',
      engaged: { cursor: 'grabbing' },
      initial: { drag: () => begin({ scratch: { x: 0 } }) },
    });
    const ctx = buildCtx();
    expect(typeof tool.cursor === 'function' ? tool.cursor(ctx as never) : tool.cursor).toBe('grab');
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    expect(typeof tool.cursor === 'function' ? tool.cursor(ctx as never) : tool.cursor).toBe('grabbing');
  });
});
