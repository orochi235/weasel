import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSelectTool } from './useSelectTool';
import type { ToolCtx } from '../../types';
import type { SelectScratch } from './useSelectTool';

function pe(over: Partial<PointerEvent> = {}): PointerEvent {
  const e = new Event('pointerdown') as PointerEvent;
  Object.assign(e, { pointerId: 1, clientX: 100, clientY: 100, button: 0, ...over });
  return e;
}

function ctxOver(over: Partial<ToolCtx<SelectScratch>> = {}): ToolCtx<SelectScratch> {
  return {
    worldX: 50,
    worldY: 50,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [], applyClick: vi.fn(), set: vi.fn(), clear: vi.fn() } as any,
    adapter: {},
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: { kind: 'idle' },
    ...over,
  };
}

/** Build a NodeHit target for declarative drag routing. The drag route table
 *  in useSelectTool keys on `target.kind` (rect/text/path) and matches
 *  category=='node'. Defaults to kind='rect' which routes to move.beginAt. */
function nodeTarget(id: string, kind: string = 'rect') {
  return { category: 'node' as const, kind, id: id as any, pose: {}, data: { id } };
}

/** Build an EmptyHit target. Drags with this target route to areaSelect.beginAt. */
function emptyTarget() {
  return { category: 'empty' as const, kind: 'empty' as const };
}

const minimalAdapter = {
  // MoveAdapter
  getNode: (id: string) => ({ id }),
  getNodes: () => [],
  getPose: (_id: string) => ({ x: 0, y: 0, width: 10, height: 10 }),
  getParent: (_id: string) => null,
  setPose: vi.fn(),
  setParent: vi.fn(),
  // AreaSelectAdapter
  hitTestArea: () => [],
  getSelection: () => [],
  setSelection: vi.fn(),
  applyOps: vi.fn(),
} as any;

describe('useSelectTool', () => {
  it('declares id "select", V keybinding, and default cursor', () => {
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      }),
    );
    expect(result.current.id).toBe('select');
    // keybinding field removed from ToolDef; key activation is now registered
    // as a `tool.shortcut.select` action via useKeybindings.
    // cursor is a resolver function (a scratch-aware override).
    // Idle scratch → 'default'.
    const cursor = result.current.cursor;
    const resolved = typeof cursor === 'function'
      ? cursor(ctxOver({ scratch: { kind: 'idle' } }))
      : cursor;
    expect(resolved).toBe('default');
  });

  it('pointer.onDown over body stashes kind:move and selects', () => {
    const applyClick = vi.fn();
    const ctx = ctxOver({
      target: nodeTarget('hit-id'),
      selection: { current: ['hit-id'], applyClick, set: vi.fn(), clear: vi.fn() } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => ['hit-id'],
        boundsOf: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(ctx.scratch).toEqual(expect.objectContaining({ kind: 'move' }));
    expect(applyClick).toHaveBeenCalledWith('hit-id', ctx.modifiers);
  });

  it('pointer.onDown picks the child over its container when both are in pickEvery', () => {
    // Regression: container's bounds also cover the child, so a click inside
    // the child returns ['F','f1'] (parent first via demo iteration order).
    // Naively taking ids[0] selects the container. With the parent/child
    // collapse, the deepest descendant — f1 — wins.
    const parents: Record<string, string | null> = { F: null, f1: 'F' };
    const adapter = {
      ...minimalAdapter,
      getParent: (id: string) => parents[id] ?? null,
    } as any;
    const applyClick = vi.fn();
    const ctx = ctxOver({
      target: nodeTarget('f1'),
      selection: { current: ['f1'], applyClick, set: vi.fn(), clear: vi.fn() } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(adapter, {
        pickEvery: () => ['F', 'f1'], // parent before child — buggy demo order
        boundsOf: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(applyClick).toHaveBeenCalledWith('f1', ctx.modifiers);
  });

  it('pointer.onDown over empty stashes kind:area', () => {
    const ctx = ctxOver({ target: emptyTarget() });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(ctx.scratch).toEqual({ kind: 'area' });
  });

  it('pointer.onDown over empty does NOT clear selection on the down (clear deferred to onClick)', () => {
    const clear = vi.fn();
    const ctx = ctxOver({
      target: emptyTarget(),
      selection: { current: ['a', 'b'], applyClick: vi.fn(), set: vi.fn(), clear } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(clear).not.toHaveBeenCalled();
  });

  it('pointer.onClick after empty pointerdown (no mods) is now a no-op in the route table (clearSelectionAction binding handles this via the gesture dispatcher)', () => {
    // The `[mods()]: clearOnEmpty` entry was removed from the click route table.
    // The new gesture dispatcher fires `clearSelectionAction` via Tool.bindings
    // for click-on-empty with no mods. The old route table entry is gone to
    // avoid double-fire. This test verifies the route-table no longer clears.
    const clear = vi.fn();
    const ctx = ctxOver({
      target: emptyTarget(),
      selection: { current: ['a', 'b'], applyClick: vi.fn(), set: vi.fn(), clear } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    result.current.pointer!.onClick!(pe(), ctx);
    // Route table no longer calls clear — the new dispatcher's clearSelection binding does.
    expect(clear).not.toHaveBeenCalled();
  });

  it('pointer.onClick after empty pointerdown with shift held does NOT clear (extend modifier)', () => {
    const clear = vi.fn();
    const ctx = ctxOver({
      target: emptyTarget(),
      modifiers: { alt: false, shift: true, meta: false, ctrl: false, space: false },
      selection: { current: ['a', 'b'], applyClick: vi.fn(), set: vi.fn(), clear } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    result.current.pointer!.onClick!(pe(), ctx);
    expect(clear).not.toHaveBeenCalled();
  });

  it('clicking a member of a multi-selection without modifier defers the collapse to onClick (so a drag moves the whole set)', () => {
    const applyClick = vi.fn();
    const ctx = ctxOver({
      target: nodeTarget('a'),
      selection: { current: ['a', 'b', 'c'], applyClick, set: vi.fn(), clear: vi.fn() } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => ['a'],
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(applyClick).not.toHaveBeenCalled();
    expect(ctx.scratch).toEqual({ kind: 'move', ids: ['a', 'b', 'c'], deferredClickId: 'a' });
  });

  it('sub-threshold release on a deferred multi-click collapses to the clicked id', () => {
    const applyClick = vi.fn();
    const ctx = ctxOver({
      target: nodeTarget('a'),
      selection: { current: ['a', 'b', 'c'], applyClick, set: vi.fn(), clear: vi.fn() } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => ['a'],
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    result.current.pointer!.onClick!(pe(), ctx);
    expect(applyClick).toHaveBeenCalledWith('a', ctx.modifiers);
  });

  it('pickBest (when supplied) replaces pickEvery+pickTopMostHit on body branch', () => {
    const pickBest = vi.fn(() => 'group-1');
    const applyClick = vi.fn();
    const ctx = ctxOver({
      target: nodeTarget('leaf'),
      selection: { current: [], applyClick, set: vi.fn(), clear: vi.fn() } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => ['leaf', 'group-1'],
        pickBest,
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(pickBest).toHaveBeenCalledWith(50, 50, false, []);
    expect(applyClick).toHaveBeenCalledWith('group-1', ctx.modifiers);
    expect(ctx.scratch).toEqual(expect.objectContaining({ kind: 'move', ids: ['group-1'], deferredClickId: null }));
  });

  it('pickBest returning null falls through to area-select', () => {
    // pickBest returning null means "no body hit" — pointerDown should
    // classify the gesture as area-select even though the dispatcher
    // forwarded a node target. The pointerDown route's body handler
    // owns the pickBest fallthrough.
    const ctx = ctxOver({ target: nodeTarget('anything') });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => ['anything'],
        pickBest: () => null,
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(ctx.scratch).toEqual({ kind: 'area' });
  });

  it('pickBest receives alt modifier and current selection', () => {
    const pickBest = vi.fn(() => 'sub');
    const ctx = ctxOver({
      target: nodeTarget('outer'),
      modifiers: { alt: true, shift: false, meta: false, ctrl: false, space: false },
      selection: { current: ['outer'], applyClick: vi.fn(), set: vi.fn(), clear: vi.fn() } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => ['outer', 'sub'],
        pickBest,
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(pickBest).toHaveBeenCalledWith(50, 50, true, ['outer']);
  });

  it('initScratch returns kind:idle', () => {
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    expect(result.current.initScratch!()).toEqual({ kind: 'idle' });
  });

  // Drag is now owned exclusively by the gesture
  // dispatcher via Tool.bindings. The legacy route-table drag entries
  // (drag.onStart/onMove/onEnd) are gone; tests that asserted on
  // `result.current.drag!.onStart!(...)` are deleted — coverage for
  // move / areaSelect lives in their action descriptors' own tests.
  // The empty-click clear is now driven by the clearSelection binding
  // (also covered at the dispatcher level).
});

import { createDebugSink } from '../../../debug/createDebugSink';

describe('useSelectTool — debug recording', () => {
  it('does not record handle hitboxes in pointer.onDown after the affordance migration', () => {
    // Corner-handle hits moved to the affordance pipeline, and
    // rotation-handle hits moved the same way. Both inline
    // `recordHitbox(...)` call sites are gone from pointer.onDown. Recording
    // for the affordance pipeline is a future concern. This test pins the
    // current state so a regression that adds inline recording back gets
    // caught.
    const sink = createDebugSink({ hitboxes: true });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => ({ x: 0, y: 0, width: 40, height: 30 }),
        debug: sink,
      }),
    );
    const ctx = ctxOver({
      target: emptyTarget(),
      selection: { current: ['a'], applyClick: vi.fn(), set: vi.fn(), clear: vi.fn() } as any,
    });
    result.current.pointer!.onDown!(pe(), ctx);
    const hits = sink.snapshot().hitboxes;
    expect(hits.filter((h) => h.kind === 'rotation')).toHaveLength(0);
    expect(hits.filter((h) => h.kind === 'handle')).toHaveLength(0);
  });
});

// useSelectTool no longer publishes its own overlay
// layer. Marquee paint moved to the dispatcher overlay layer
// (`useDispatcherOverlayLayer`); move ghosts moved to the preview-ghost
// layer (`usePreviewGhostLayer`). The `useSelectTool overlay` describe
// block has been deleted — coverage moved to those layers' tests and to
// the dispatcher actions' own tests.

describe('useSelectTool — declarative dblTap forwards raw event', () => {
  it('passes the raw PointerEvent to onDoubleTap', () => {
    // dblTap was migrated to a declarative route that
    // reads the event via the new optional ActionFn parameter. Pin the
    // raw-event-forwarding contract so a regression in the routing
    // factory (or the ActionFn signature) gets caught.
    const onDoubleTap = vi.fn();
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => ['hit-id'],
        boundsOf: () => null,
        onDoubleTap,
      }),
    );
    const ctx = ctxOver({ target: nodeTarget('hit-id') });
    const event = pe();
    result.current.dblTap!.onTap!(event, ctx);
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    const call = onDoubleTap.mock.calls[0]?.[0] as
      | { worldX: number; worldY: number; ids: string[]; event: PointerEvent }
      | undefined;
    expect(call?.event).toBe(event);
    expect(call?.ids).toEqual(['hit-id']);
    expect(call?.worldX).toBe(50);
    expect(call?.worldY).toBe(50);
  });

  it('claims when onDoubleTap is supplied and passes otherwise', () => {
    // The route returns claim() so the dispatcher suppresses the
    // regular onClick on the second tap. Without onDoubleTap there's
    // nothing to forward, so the route returns none() and the
    // dispatcher falls through to onClick.
    const { result: withCb } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
        onDoubleTap: vi.fn(),
      }),
    );
    const { result: withoutCb } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    const ctxA = ctxOver({ target: emptyTarget() });
    const ctxB = ctxOver({ target: emptyTarget() });
    expect(withCb.current.dblTap!.onTap!(pe(), ctxA)).toBe('claim');
    expect(withoutCb.current.dblTap!.onTap!(pe(), ctxB)).toBe('pass');
  });
});

describe('useSelectTool — declarative routing', () => {
  // useSelectTool's gesture surface is
  // fully declarative — pointerDown / click / drag / dblTap all route through
  // tables. These tests pin the routing-table semantics so a regression in
  // the modifier sub-tables, drag-target dispatch, or cursor phase override
  // gets caught before it ships.

  it('shift-click on a selected rect forwards the shift modifier to applyClick (lets it remove from selection)', () => {
    // Modifier-aware applyClick is the single source of selection mutation
    // in the body branch — the click route hands the modifier through and
    // applyClick decides whether to add, remove, or replace. We pin the
    // hand-through here; the actual remove-from-set logic is exercised by
    // the selection helper's own tests.
    const applyClick = vi.fn();
    const ctx = ctxOver({
      target: nodeTarget('hit-id'),
      modifiers: { alt: false, shift: true, meta: false, ctrl: false, space: false },
      selection: { current: ['hit-id'], applyClick, set: vi.fn(), clear: vi.fn() } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => ['hit-id'],
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    // Shift = extend modifier, so the deferred-collapse branch doesn't
    // engage (isExtend short-circuits the defer). applyClick runs
    // immediately on down with the shift modifier.
    expect(applyClick).toHaveBeenCalledWith('hit-id', ctx.modifiers);
    expect(applyClick.mock.calls[0][1].shift).toBe(true);
  });

  it('shift-click on empty preserves selection (does not clear)', () => {
    // The click route's empty branch has a mods('shift') sub-table that
    // returns none(), so the default clearOnEmpty doesn't run.
    const clear = vi.fn();
    const ctx = ctxOver({
      target: emptyTarget(),
      modifiers: { alt: false, shift: true, meta: false, ctrl: false, space: false },
      selection: { current: ['a', 'b'], applyClick: vi.fn(), set: vi.fn(), clear } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    result.current.pointer!.onClick!(pe(), ctx);
    expect(clear).not.toHaveBeenCalled();
  });

  it('alt-click on a rect falls through to plain selection (clone is alt-drag, not alt-click)', () => {
    // useSelectTool deliberately does NOT special-case alt in its click
    // table — there's no `[mods('alt')]` sub-table on the node-kind
    // routes. The default route runs: applyClick is called with the alt
    // modifier and applyClick's own rules decide what to do. Cloning is
    // alt-drag (routed via the select tool's own alt-drag→clone binding),
    // NOT alt-click. This test pins the absence of a clone-on-alt-click
    // route so a future accidental addition gets flagged.
    const applyClick = vi.fn();
    const ctx = ctxOver({
      target: nodeTarget('hit-id'),
      modifiers: { alt: true, shift: false, meta: false, ctrl: false, space: false },
      selection: { current: [], applyClick, set: vi.fn(), clear: vi.fn() } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => ['hit-id'],
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(applyClick).toHaveBeenCalledWith('hit-id', ctx.modifiers);
    expect(applyClick.mock.calls[0][1].alt).toBe(true);
    // Scratch is move (not a clone-specific kind) — the drag route would
    // dispatch to move.beginAt.
    expect(ctx.scratch).toEqual(expect.objectContaining({ kind: 'move' }));
  });

  // Route-table drag entries deleted; drag is owned
  // by the gesture dispatcher via Tool.bindings. The "drag opens engaged
  // scratch" assertions don't have a route-table surface to drive
  // anymore — engaged scratch is now set by pointerDown's begin() and
  // by the dispatcher's action invocation, both covered elsewhere.
  it('cursor resolver returns "move" when scratch.kind === "move"', () => {
    // The cursor is scratch-aware. Once a move gesture engages
    // (scratch.kind === 'move'), the host should show the move cursor.
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    const cursor = result.current.cursor;
    expect(typeof cursor).toBe('function');
    const resolved = (cursor as (ctx: any) => string)(
      ctxOver({ scratch: { kind: 'move', ids: ['a'], deferredClickId: null } }),
    );
    expect(resolved).toBe('move');
  });

  it('cursor resolver returns "crosshair" when scratch.kind === "area"', () => {
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    const cursor = result.current.cursor;
    expect(typeof cursor).toBe('function');
    const resolved = (cursor as (ctx: any) => string)(
      ctxOver({ scratch: { kind: 'area' } }),
    );
    expect(resolved).toBe('crosshair');
  });

  it('cursor resolver returns "default" for unknown / idle scratch', () => {
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    const cursor = result.current.cursor;
    const resolved = (cursor as (ctx: any) => string)(
      ctxOver({ scratch: { kind: 'idle' } }),
    );
    expect(resolved).toBe('default');
  });
});
