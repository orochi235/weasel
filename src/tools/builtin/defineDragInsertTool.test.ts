import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { defineDragInsertTool } from './defineDragInsertTool';
import type { InsertController } from 'interactions/gestures/insert/insert';

const makeController = (
  overrides: Partial<InsertController<{ id: string }, unknown>> = {},
) =>
  ({
    start: vi.fn(),
    move: vi.fn(() => true),
    end: vi.fn(),
    cancel: vi.fn(),
    overlay: null,
    isInserting: false,
    adapter: {} as InsertController<{ id: string }, unknown>['adapter'],
    supportsPointInsert: false,
    supportsCommitInsert: true,
    ...overrides,
  }) as InsertController<{ id: string }, unknown>;

const DEFAULT_STYLE = { fill: '#aaa', stroke: '#bbb', dash: [2, 2], lineWidth: 1 };

describe('defineDragInsertTool', () => {
  it('builds a Tool with id/cursor/keybinding and overlay', () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      defineDragInsertTool({
        id: 'x',
        cursor: 'crosshair',
        keybinding: { key: 'X' },
        controller,
        overlayId: 'x-overlay',
        overlayLabel: 'X overlay',
        defaultStyle: DEFAULT_STYLE,
      }),
    );
    expect(result.current.tool.id).toBe('x');
    expect(result.current.tool.cursor).toBe('crosshair');
    expect(result.current.tool.keybinding).toEqual({ key: 'X' });
    expect(result.current.tool.overlay?.id).toBe('x-overlay');
  });

  it('omits drag handlers when controller.supportsCommitInsert is false', () => {
    const controller = makeController({
      supportsCommitInsert: false,
      supportsPointInsert: true,
    });
    const { result } = renderHook(() =>
      defineDragInsertTool({
        id: 't',
        cursor: 'text',
        controller,
        overlayId: 't-overlay',
        overlayLabel: 'T overlay',
        defaultStyle: DEFAULT_STYLE,
      }),
    );
    expect(result.current.tool.drag).toBeUndefined();
    expect(result.current.tool.pointer?.onClick).toBeDefined();
  });

  it('omits pointer.onClick when controller.supportsPointInsert is false', () => {
    const controller = makeController({
      supportsPointInsert: false,
      supportsCommitInsert: true,
    });
    const { result } = renderHook(() =>
      defineDragInsertTool({
        id: 'i',
        cursor: 'crosshair',
        controller,
        overlayId: 'i-overlay',
        overlayLabel: 'I overlay',
        defaultStyle: DEFAULT_STYLE,
      }),
    );
    expect(result.current.tool.pointer?.onClick).toBeUndefined();
    expect(result.current.tool.drag).toBeDefined();
  });

  it('hitExisting gate fires on pointer.onClick and skips controller.start', () => {
    const controller = makeController({ supportsPointInsert: true });
    const hitExisting = vi.fn(() => 'obj-1');
    const { result } = renderHook(() =>
      defineDragInsertTool({
        id: 't',
        cursor: 'text',
        controller,
        overlayId: 't-overlay',
        overlayLabel: 'T overlay',
        defaultStyle: DEFAULT_STYLE,
        hitExisting,
      }),
    );
    const setSel = vi.fn();
    const ctx = {
      worldX: 5,
      worldY: 6,
      modifiers: { shift: false, alt: false, meta: false, ctrl: false },
      selection: { set: setSel } as any,
      applyOps: vi.fn(),
      scratch: undefined,
    } as any;
    const verdict = result.current.tool.pointer!.onClick!({} as any, ctx);
    expect(hitExisting).toHaveBeenCalledWith({ x: 5, y: 6 });
    expect(setSel).toHaveBeenCalledWith(['obj-1']);
    expect(controller.start).not.toHaveBeenCalled();
    expect(verdict).toBe('claim');
  });

  it('captures ctx.applyOps on drag.onStart and clears on onEnd', () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      defineDragInsertTool({
        id: 'i',
        cursor: 'crosshair',
        controller,
        overlayId: 'i-overlay',
        overlayLabel: 'I overlay',
        defaultStyle: DEFAULT_STYLE,
      }),
    );
    const applyOps = vi.fn();
    const ctx = {
      worldX: 0,
      worldY: 0,
      modifiers: { shift: false, alt: false, meta: false, ctrl: false },
      selection: { set: vi.fn() } as any,
      applyOps,
      scratch: undefined,
    } as any;
    result.current.tool.drag!.onStart!({} as any, ctx);
    expect(result.current.applyOpsRef.current).toBe(applyOps);
    result.current.tool.drag!.onEnd!({} as any, ctx);
    expect(result.current.applyOpsRef.current).toBeNull();
  });
});
