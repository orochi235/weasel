import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEditAnchorsTool } from './useEditAnchorsTool';
import { useEditAnchors } from 'interactions/gestures/edit-anchors';
import { PathBuilder } from 'features/paths/builder';
import type { Path, PolygonPath } from 'features/paths/types';
import type { Op } from 'core/ops/types';
import type { ToolCtx } from '../types';

function makePath(): PolygonPath {
  return new PathBuilder()
    .moveTo(0, 0)
    .curveTo(20, 0, 80, 100, 100, 100)
    .lineTo(100, 200)
    .build();
}

function makeAdapter(initial: Path) {
  let pose: Path = initial;
  const batches: { ops: Op[]; label?: string }[] = [];
  return {
    adapter: {
      getNode: (id: string) => (id === 'p' ? { id } : undefined),
      getPose: (_id: string) => pose,
      setPose: (_id: string, p: Path) => { pose = p; },
      applyOps: (ops: Op[], label?: string) => {
        batches.push({ ops, label });
        for (const op of ops) op.apply({ setPose: (_id: string, p: Path) => { pose = p; } });
      },
    },
    batches,
    getPose: () => pose,
  };
}

function setup(editingId: string | null = 'p') {
  const { adapter, batches, getPose } = makeAdapter(makePath());
  const onExit = vi.fn();
  const { result } = renderHook(() => {
    const controller = useEditAnchors(adapter, { editingId, hitRadius: 8 });
    const tool = useEditAnchorsTool(controller, { onExit });
    return { controller, tool };
  });
  return { adapter, batches, getPose, onExit, ...result.current };
}

function makeCtx<S>(scratch: S, over: Partial<ToolCtx<S>> = {}): ToolCtx<S> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [], applyClick: vi.fn() } as unknown as ToolCtx['selection'],
    adapter: {},
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch,
    ...over,
  };
}

function pe(): PointerEvent {
  const e = new Event('pointerdown') as PointerEvent;
  Object.assign(e, { pointerId: 1, clientX: 0, clientY: 0 });
  return e;
}

function ke(key: string): KeyboardEvent {
  const e = new Event('keydown') as KeyboardEvent;
  Object.assign(e, { key });
  return e;
}

describe('useEditAnchorsTool', () => {
  it('declares id, keybinding A, default cursor, and an overlay layer', () => {
    const { tool } = setup();
    expect(tool.id).toBe('edit-anchors');
    expect(tool.keybinding).toEqual({ key: 'A' });
    expect(tool.cursor).toBe('default');
    expect(tool.overlay).toBeDefined();
    expect(tool.overlay!.id).toBe('anchor-edit-overlay');
  });

  it('respects custom id / keybinding / cursor options', () => {
    const adapter = makeAdapter(makePath()).adapter;
    const { result } = renderHook(() => {
      const c = useEditAnchors(adapter, { editingId: 'p' });
      return useEditAnchorsTool(c, { id: 'pe', keybinding: { key: 'E' }, cursor: 'crosshair' });
    });
    expect(result.current.id).toBe('pe');
    expect(result.current.keybinding).toEqual({ key: 'E' });
    expect(result.current.cursor).toBe('crosshair');
  });

  it('pointer.onDown on an anchor stashes pendingStart with the hit', () => {
    const { tool } = setup();
    const scratch = tool.initScratch!();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    expect(scratch.pendingStart).toMatchObject({
      id: 'p',
      hit: { anchorIndex: 0, kind: 'anchor', coordIndex: 0 },
      worldX: 0,
      worldY: 0,
    });
  });

  it('pointer.onDown on empty space clears pendingStart and calls clearSelection', () => {
    const { tool, controller } = setup();
    const clearSpy = vi.spyOn(controller, 'clearSelection');
    const scratch = tool.initScratch!();
    // Stash a hit first so we can verify it gets cleared.
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    expect(scratch.pendingStart).not.toBeNull();
    // Click empty.
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 999, worldY: 999 }));
    expect(scratch.pendingStart).toBeNull();
    expect(clearSpy).toHaveBeenCalledOnce();
  });

  it('drag.onStart with no pendingStart passes through (sub-threshold non-anchor)', () => {
    const { tool } = setup();
    const scratch = tool.initScratch!();
    expect(tool.drag!.onStart!(pe(), makeCtx(scratch))).toBe('pass');
  });

  it('full drag mutates the anchor and dispatches one op via applyOps', () => {
    const { tool, batches, getPose } = setup();
    const scratch = tool.initScratch!();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    tool.drag!.onMove!(pe(), makeCtx(scratch, { worldX: 12, worldY: 34 }));
    tool.drag!.onEnd!(pe(), makeCtx(scratch));
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Edit anchors');
    const path = getPose() as PolygonPath;
    expect(path.coords[0]).toBe(12);
    expect(path.coords[1]).toBe(34);
  });

  it('drag.onCancel cancels the in-flight edit without dispatching', () => {
    const { tool, batches, getPose } = setup();
    const scratch = tool.initScratch!();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    tool.drag!.onMove!(pe(), makeCtx(scratch, { worldX: 12, worldY: 34 }));
    tool.drag!.onCancel!(makeCtx(scratch));
    expect(batches).toHaveLength(0);
    const path = getPose() as PolygonPath;
    expect(path.coords[0]).toBe(0);
    expect(path.coords[1]).toBe(0);
  });

  it('keyboard Escape calls onExit and cancels any in-flight drag', () => {
    const { tool, onExit, batches } = setup();
    const scratch = tool.initScratch!();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    tool.drag!.onStart!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    tool.drag!.onMove!(pe(), makeCtx(scratch, { worldX: 12, worldY: 34 }));
    expect(tool.keyboard!.onDown!(ke('Escape'), makeCtx(scratch))).toBe('claim');
    expect(onExit).toHaveBeenCalledOnce();
    expect(batches).toHaveLength(0);
  });

  it('keyboard non-Escape keys pass through', () => {
    const { tool } = setup();
    const scratch = tool.initScratch!();
    expect(tool.keyboard!.onDown!(ke('a'), makeCtx(scratch))).toBe('pass');
  });

  it('with no editingId, pointer.onDown finds nothing and stashes no pendingStart', () => {
    const { tool } = setup(null);
    const scratch = tool.initScratch!();
    tool.pointer!.onDown!(pe(), makeCtx(scratch, { worldX: 0, worldY: 0 }));
    expect(scratch.pendingStart).toBeNull();
  });
});
