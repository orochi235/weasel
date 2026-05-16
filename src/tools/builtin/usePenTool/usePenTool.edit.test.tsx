import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePenTool } from './usePenTool';
import { commitEditAsOp } from './penEdit/scratch';
import { dragAnchor } from './penEdit/actions';
import { PathBuilder } from 'features/paths/builder';
import type { ToolCtx } from '../../types';
import type { PenScratch } from './usePenTool';
import type { PolygonPath } from 'features/paths/types';
import type { Op } from 'core/ops/types';

// ---------------------------------------------------------------------------
// Minimal history: stores op batches so we can invert and replay (undo) them.
// ---------------------------------------------------------------------------
interface HistoryEntry { ops: Op[] }

function makeHistory(adapterRef: { current: Record<string, unknown> }) {
  const entries: HistoryEntry[] = [];

  function applyOps(ops: Op[], _label: string) {
    for (const op of ops) op.apply(adapterRef.current);
    entries.push({ ops: [...ops] });
  }

  function undo() {
    const last = entries.pop();
    if (!last) return;
    for (let i = last.ops.length - 1; i >= 0; i--) {
      last.ops[i].invert().apply(adapterRef.current);
    }
  }

  return { applyOps, undo, entries };
}

// ---------------------------------------------------------------------------
// Adapter factory — extends the create-mode adapter with setPath for edit ops.
// ---------------------------------------------------------------------------
interface Pose { kind: 'path'; path: PolygonPath; closed: boolean }

function makeAdapter() {
  let n = 0;
  const added: Pose[] = [];
  const ids: string[] = [];
  const setSelection = vi.fn();
  const addNode = vi.fn((p: Pose) => {
    const id = `o${++n}`;
    added.push(p);
    ids.push(id);
    return id;
  });
  const setPath = vi.fn();
  return { added, ids, addNode, setSelection, setPath };
}

// ---------------------------------------------------------------------------
// Setup wiring for edit-mode tests.
// ---------------------------------------------------------------------------
type GetPathObj = NonNullable<Parameters<typeof usePenTool<Pose>>[0]['getPathObj']>;

interface SetupEditOptions {
  getPathObj?: GetPathObj;
}

function setupEdit(opts: SetupEditOptions = {}) {
  const adapter = makeAdapter();
  // History replays ops against the same adapter object.
  const adapterRef = { current: adapter as Record<string, unknown> };
  const history = makeHistory(adapterRef);

  const wrapPath = vi.fn((path: PolygonPath, o: { closed: boolean }): Pose => ({
    kind: 'path', path, closed: o.closed,
  }));

  const { result } = renderHook(() => usePenTool<Pose>({
    wrapPath,
    adapter: { ...adapter, applyOps: history.applyOps },
    getPathObj: opts.getPathObj,
  }));

  const { tool } = result.current;
  const scratch = tool.initScratch!() as PenScratch;
  return { tool, adapter, history, wrapPath, scratch };
}

// ---------------------------------------------------------------------------
// ToolCtx factory — mirrors the one in usePenTool.test.tsx.
// ---------------------------------------------------------------------------
function makeCtx<S>(scratch: S, over: Partial<ToolCtx<S>> = {}): ToolCtx<S> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [], applyClick: vi.fn() } as unknown as ToolCtx['selection'],
    adapter: {},
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    setView: () => {},
    canvasRect: new DOMRect(),
    target: { category: 'empty', kind: 'empty' } as ToolCtx['target'],
    scratch,
    ...over,
  };
}

function pe(clientX = 0, clientY = 0): PointerEvent {
  const e = new Event('pointerdown') as PointerEvent;
  Object.assign(e, { pointerId: 1, clientX, clientY, button: 0 });
  return e;
}

function ke(key: string): KeyboardEvent {
  const e = new Event('keydown') as KeyboardEvent;
  Object.assign(e, { key });
  return e;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('pen tool edit-mode integration', () => {
  it('dblclick on a path obj enters edit; anchor drag commits a SetPathOp; undo restores', () => {
    // Build a triangle polygon path: (0,0) → (10,0) → (10,10).
    const origPath = new PathBuilder()
      .moveTo(0, 0)
      .lineTo(10, 0)
      .lineTo(10, 10)
      .build();

    const objId = 'obj1';

    const { tool, adapter, history, scratch } = setupEdit({
      getPathObj: (id) => id === objId
        ? { path: origPath, closed: false, params: undefined, tool: 'pen' }
        : null,
    });

    // ------------------------------------------------------------------
    // Step 1: simulate dblclick to enter edit mode.
    // Prime _lastClick (recent timestamp, same world position) then dispatch
    // a click with target.category === 'node'. Mirrors the _lastClick
    // manipulation used by existing tests for double-click open-finish.
    // ------------------------------------------------------------------
    scratch._lastClick = { t: performance.now(), x: 0, y: 0 };
    tool.pointer!.onClick!(pe(), makeCtx(scratch, {
      worldX: 0,
      worldY: 0,
      target: { category: 'node', kind: 'node', id: objId } as ToolCtx['target'],
    }));

    // Should now be in edit mode.
    expect(scratch.mode).toBe('edit');
    expect(scratch.edit).not.toBeNull();

    // ------------------------------------------------------------------
    // Step 2: verify derived anchors match the original triangle path.
    // ------------------------------------------------------------------
    const anchors = scratch.edit!.anchors[0];
    expect(anchors).toHaveLength(3);
    expect(anchors[0]).toMatchObject({ x: 0, y: 0 });
    expect(anchors[1]).toMatchObject({ x: 10, y: 0 });
    expect(anchors[2]).toMatchObject({ x: 10, y: 10 });

    // ------------------------------------------------------------------
    // Step 3: drag anchor at index 1 (10, 0) down 5 units → (10, 5).
    // Call dragAnchor directly — mirrors what the anchor drag route's
    // onMove does internally.
    // ------------------------------------------------------------------
    dragAnchor(scratch, { sub: 0, idx: 1, dx: 0, dy: 5 });
    expect(scratch.edit!.dirty).toBe(true);

    // Build the op (same as drag route's onRelease) and apply it.
    const op = commitEditAsOp(scratch);
    expect(op).not.toBeNull();
    history.applyOps([op!], 'Move anchor');

    // setPath should have been called with the new anchor geometry.
    expect(adapter.setPath).toHaveBeenCalledTimes(1);
    const [calledId, calledFields] = adapter.setPath.mock.calls[0] as
      [string, { path: PolygonPath; closed: boolean; params: unknown }];
    expect(calledId).toBe(objId);
    // The moved anchor changes the coords.
    expect(Array.from(calledFields.path.coords)).not.toEqual(Array.from(origPath.coords));

    // ------------------------------------------------------------------
    // Step 4: undo — should restore the original path.
    // ------------------------------------------------------------------
    history.undo();

    expect(adapter.setPath).toHaveBeenCalledTimes(2);
    const [undoId, undoFields] = adapter.setPath.mock.calls[1] as
      [string, { path: PolygonPath; closed: boolean; params: unknown }];
    expect(undoId).toBe(objId);
    // Restored path's commands and coords must match the original exactly.
    expect(Array.from(undoFields.path.commands)).toEqual(Array.from(origPath.commands));
    expect(Array.from(undoFields.path.coords)).toEqual(Array.from(origPath.coords));
  });

  it('dblclick on a rect obj enters edit; Escape exits with no setPath call (no-mutation no-op trapdoor)', () => {
    const objId = 'obj2';
    const rectPath = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };

    const { tool, adapter, scratch } = setupEdit({
      getPathObj: (id) => id === objId
        ? { path: rectPath, closed: true, params: undefined, tool: 'rect' }
        : null,
    });

    // Simulate dblclick: prime _lastClick, then dispatch a node click.
    scratch._lastClick = { t: performance.now(), x: 5, y: 5 };
    tool.pointer!.onClick!(pe(), makeCtx(scratch, {
      worldX: 5,
      worldY: 5,
      target: { category: 'node', kind: 'node', id: objId } as ToolCtx['target'],
    }));

    // Should be in edit mode.
    expect(scratch.mode).toBe('edit');
    // preConvert populated because tool is 'rect' (not pen/pencil/imported).
    expect(scratch.edit!.preConvert).not.toBeNull();
    expect(scratch.edit!.preConvert!.path).toEqual(rectPath);
    // Anchors: four corners of the rect, closed.
    expect(scratch.edit!.anchors[0]).toHaveLength(4);
    expect(scratch.edit!.closed[0]).toBe(true);

    // Press Escape without mutating any anchors.
    tool.keyboard!.onDown!(ke('Escape'), makeCtx(scratch));

    // Should have returned to create mode.
    expect(scratch.mode).toBe('create');
    expect(scratch.edit).toBeNull();
    // setPath must NOT have been called — no mutation → no op → no trapdoor.
    expect(adapter.setPath).not.toHaveBeenCalled();
  });

  it('dblclick on a rect, drag a corner — trapdoor fires (polygon emitted, params cleared); undo restores rect', () => {
    const objId = 'obj3';
    const rectPath = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };

    const { tool, adapter, history, scratch } = setupEdit({
      getPathObj: (id) => id === objId
        ? { path: rectPath, closed: true, params: undefined, tool: 'rect' }
        : null,
    });

    // Simulate dblclick → enter edit mode.
    scratch._lastClick = { t: performance.now(), x: 0, y: 0 };
    tool.pointer!.onClick!(pe(), makeCtx(scratch, {
      worldX: 0,
      worldY: 0,
      target: { category: 'node', kind: 'node', id: objId } as ToolCtx['target'],
    }));

    expect(scratch.mode).toBe('edit');
    // preConvert set because 'rect' is a parametric tool.
    expect(scratch.edit!.preConvert).not.toBeNull();

    // Drag anchor 0 (top-left corner at (0,0)) down by 5 units.
    dragAnchor(scratch, { sub: 0, idx: 0, dx: 0, dy: 5 });
    expect(scratch.edit!.dirty).toBe(true);

    // Build and apply the op.
    const op = commitEditAsOp(scratch);
    expect(op).not.toBeNull();
    history.applyOps([op!], 'Move anchor');

    // Trapdoor: emitted path must be a polygon, params cleared.
    expect(adapter.setPath).toHaveBeenCalledTimes(1);
    const [calledId, calledFields] = adapter.setPath.mock.calls[0] as
      [string, { path: { kind: string }; closed: boolean; params: unknown }];
    expect(calledId).toBe(objId);
    expect(calledFields.path.kind).toBe('polygon');
    expect(calledFields.params).toBeUndefined();

    // Undo → must restore the original RectPath (not the intermediate polygon).
    history.undo();

    expect(adapter.setPath).toHaveBeenCalledTimes(2);
    const [undoId, undoFields] = adapter.setPath.mock.calls[1] as
      [string, { path: { kind: string; x: number; y: number; width: number; height: number }; closed: boolean; params: unknown }];
    expect(undoId).toBe(objId);
    expect(undoFields.path.kind).toBe('rect');
    expect(undoFields.path).toMatchObject({ x: 0, y: 0, width: 10, height: 10 });
    // params restored to their pre-edit value (undefined).
    expect(undoFields.params).toBeUndefined();
  });

  it('shift+click on a path obj enters edit mode without placing an anchor', () => {
    const objId = 'obj4';
    const origPath = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).build();

    const { tool, scratch } = setupEdit({
      getPathObj: (id) => id === objId
        ? { path: origPath, closed: false, params: undefined, tool: 'pen' }
        : null,
    });

    tool.pointer!.onClick!(pe(), makeCtx(scratch, {
      worldX: 5,
      worldY: 0,
      modifiers: { alt: false, shift: true, meta: false, ctrl: false, space: false },
      target: { category: 'node', kind: 'node', id: objId } as ToolCtx['target'],
    }));

    expect(scratch.mode).toBe('edit');
    expect(scratch.edit).not.toBeNull();
    // No stub anchor placed on the in-progress subpath.
    expect(scratch.current).toBeNull();
  });

  it('alt+click on a path obj inserts an anchor at the nearest point and emits a SetPathOp', () => {
    const objId = 'obj5';
    // 4-segment open path with collinear lerps: (0,0) → (10,0) → (20,0) → (30,0).
    const origPath = new PathBuilder()
      .moveTo(0, 0)
      .lineTo(10, 0)
      .lineTo(20, 0)
      .lineTo(30, 0)
      .build();

    const { tool, adapter, scratch } = setupEdit({
      getPathObj: (id) => id === objId
        ? { path: origPath, closed: false, params: undefined, tool: 'pen' }
        : null,
    });

    tool.pointer!.onClick!(pe(), makeCtx(scratch, {
      worldX: 15,
      worldY: 0,
      modifiers: { alt: true, shift: false, meta: false, ctrl: false, space: false },
      target: { category: 'node', kind: 'node', id: objId } as ToolCtx['target'],
    }));

    // A SetPathOp must have been applied with one extra anchor — verify via
    // setPath spy (the test's history.applyOps invokes ops which call setPath).
    expect(adapter.setPath).toHaveBeenCalledTimes(1);
    const [calledId, calledFields] = adapter.setPath.mock.calls[0] as
      [string, { path: PolygonPath; closed: boolean }];
    expect(calledId).toBe(objId);
    // Original had 4 anchors → new path should encode 5.
    const origMCount = Array.from(origPath.commands).filter((c) => c === origPath.commands[0]).length;
    const newMCount = Array.from(calledFields.path.commands).filter((c) => c === calledFields.path.commands[0]).length;
    expect(newMCount).toBe(origMCount); // subpath count unchanged
    // 4 anchors → 3 segments (L/C); 5 anchors → 4 segments. Total non-M command count grew by 1.
    const origSegCount = origPath.commands.length - origMCount;
    const newSegCount = calledFields.path.commands.length - newMCount;
    expect(newSegCount).toBe(origSegCount + 1);
    // Pen mode unchanged — alt+click is a single-step op, not an edit-mode entry.
    expect(scratch.mode).toBe('create');
    expect(scratch.current).toBeNull();
  });
});
