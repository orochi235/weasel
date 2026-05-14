import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEditAnchorsTool } from './useEditAnchorsTool';
import { useEditAnchors } from 'interactions/gestures/edit-anchors';
import { PathBuilder } from 'features/paths/builder';
import type { Path, PolygonPath } from 'features/paths/types';
import type { Op } from 'core/ops/types';
import type { ToolCtx } from '../../types';
import type { HitResult } from '../../routing/hitResult';

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

const nodeTarget = (id = 'p', kind = 'path'): HitResult => ({
  category: 'node', kind, id: id as never, pose: {}, data: {},
});
const emptyTarget = (): HitResult => ({ category: 'empty', kind: 'empty' });

function makeCtx(
  target: HitResult,
  over: Partial<ToolCtx<null>> = {},
): ToolCtx<null> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    target,
    selection: { current: [], applyClick: vi.fn() } as unknown as ToolCtx['selection'],
    adapter: {},
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: null,
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
    // cursor is a resolver function from the declarative defineTool.
    const cursor = typeof tool.cursor === 'function'
      ? tool.cursor(makeCtx(emptyTarget()))
      : tool.cursor;
    expect(cursor).toBe('default');
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
    const cursor = typeof result.current.cursor === 'function'
      ? result.current.cursor(makeCtx(emptyTarget()))
      : result.current.cursor;
    expect(cursor).toBe('crosshair');
  });

  it('pointerDown on an anchor claims and primes the drag', () => {
    const { tool, batches, getPose } = setup();
    // Down on the anchor at (0,0) — pointerDown should claim.
    const decision = tool.pointer!.onDown!(pe(), makeCtx(nodeTarget(), { worldX: 0, worldY: 0 }));
    expect(decision).toBe('claim');
    // Threshold-cross: drag.onStart consumes the stashed hit and starts
    // the controller. A full drag-and-release then commits one batch.
    tool.drag!.onStart!(pe(), makeCtx(nodeTarget(), { worldX: 0, worldY: 0 }));
    tool.drag!.onMove!(pe(), makeCtx(nodeTarget(), { worldX: 12, worldY: 34 }));
    tool.drag!.onEnd!(pe(), makeCtx(nodeTarget()));
    expect(batches).toHaveLength(1);
    const path = getPose() as PolygonPath;
    expect(path.coords[0]).toBe(12);
    expect(path.coords[1]).toBe(34);
  });

  it('pointerDown on empty space clears selection and claims', () => {
    const { tool, controller } = setup();
    const clearSpy = vi.spyOn(controller, 'clearSelection');
    // Click empty (far from any anchor).
    const decision = tool.pointer!.onDown!(
      pe(),
      makeCtx(emptyTarget(), { worldX: 999, worldY: 999 }),
    );
    expect(decision).toBe('claim');
    expect(clearSpy).toHaveBeenCalledOnce();
  });

  it('pointerDown on a non-anchor body hit also clears selection', () => {
    // Route uses '*' for node hits — same handler as 'empty' since the
    // controller hand-rolls hit math. A body hit that doesn't land on an
    // anchor still clears highlight.
    const { tool, controller } = setup();
    const clearSpy = vi.spyOn(controller, 'clearSelection');
    tool.pointer!.onDown!(pe(), makeCtx(nodeTarget(), { worldX: 999, worldY: 999 }));
    expect(clearSpy).toHaveBeenCalledOnce();
  });

  it('drag.onStart with no pending hit passes through (sub-threshold non-anchor)', () => {
    const { tool } = setup();
    expect(tool.drag!.onStart!(pe(), makeCtx(emptyTarget()))).toBe('pass');
  });

  it('drag commit applies the edit and labels the batch', () => {
    const { tool, batches, getPose } = setup();
    tool.pointer!.onDown!(pe(), makeCtx(nodeTarget(), { worldX: 0, worldY: 0 }));
    tool.drag!.onStart!(pe(), makeCtx(nodeTarget(), { worldX: 0, worldY: 0 }));
    tool.drag!.onMove!(pe(), makeCtx(nodeTarget(), { worldX: 12, worldY: 34 }));
    tool.drag!.onEnd!(pe(), makeCtx(nodeTarget()));
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Edit anchors');
    const path = getPose() as PolygonPath;
    expect(path.coords[0]).toBe(12);
    expect(path.coords[1]).toBe(34);
  });

  it('drag.onCancel cancels the in-flight edit without dispatching', () => {
    const { tool, batches, getPose } = setup();
    tool.pointer!.onDown!(pe(), makeCtx(nodeTarget(), { worldX: 0, worldY: 0 }));
    tool.drag!.onStart!(pe(), makeCtx(nodeTarget(), { worldX: 0, worldY: 0 }));
    tool.drag!.onMove!(pe(), makeCtx(nodeTarget(), { worldX: 12, worldY: 34 }));
    tool.drag!.onCancel!(makeCtx(nodeTarget()));
    expect(batches).toHaveLength(0);
    const path = getPose() as PolygonPath;
    expect(path.coords[0]).toBe(0);
    expect(path.coords[1]).toBe(0);
  });

  it('keyboard Escape calls onExit and cancels any in-flight drag', () => {
    const { tool, onExit, batches } = setup();
    tool.pointer!.onDown!(pe(), makeCtx(nodeTarget(), { worldX: 0, worldY: 0 }));
    tool.drag!.onStart!(pe(), makeCtx(nodeTarget(), { worldX: 0, worldY: 0 }));
    tool.drag!.onMove!(pe(), makeCtx(nodeTarget(), { worldX: 12, worldY: 34 }));
    expect(tool.keyboard!.onDown!(ke('Escape'), makeCtx(emptyTarget()))).toBe('claim');
    expect(onExit).toHaveBeenCalledOnce();
    expect(batches).toHaveLength(0);
  });

  it('keyboard non-Escape keys pass through', () => {
    const { tool } = setup();
    expect(tool.keyboard!.onDown!(ke('a'), makeCtx(emptyTarget()))).toBe('pass');
  });

  it('with no editingId, pointerDown finds nothing and falls back to clear', () => {
    const { tool, controller } = setup(null);
    const clearSpy = vi.spyOn(controller, 'clearSelection');
    tool.pointer!.onDown!(pe(), makeCtx(emptyTarget(), { worldX: 0, worldY: 0 }));
    // Subsequent drag.onStart must pass since no hit was stashed.
    expect(tool.drag!.onStart!(pe(), makeCtx(emptyTarget()))).toBe('pass');
    expect(clearSpy).toHaveBeenCalled();
  });
});
