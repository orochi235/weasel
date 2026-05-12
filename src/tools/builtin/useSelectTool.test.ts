import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelectTool } from './useSelectTool';
import type { ToolCtx } from '../types';
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
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: { kind: 'idle' },
    ...over,
  };
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
    expect(result.current.keybinding).toEqual({ key: 'V' });
    expect(result.current.cursor).toBe('default');
  });

  it('pointer.onDown over body stashes kind:move and selects', () => {
    const applyClick = vi.fn();
    const ctx = ctxOver({
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
    const ctx = ctxOver();
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

  it('pointer.onClick after empty pointerdown clears selection (sub-threshold release)', () => {
    const clear = vi.fn();
    const ctx = ctxOver({
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
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('pointer.onClick after empty pointerdown with shift held does NOT clear (extend modifier)', () => {
    const clear = vi.fn();
    const ctx = ctxOver({
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
    const ctx = ctxOver();
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

  it('overlay.hitTest over resize handle returns a AffordanceBinding that drives useResize', () => {
    // Corner-handle hits now flow through the tool's overlay.hitTest (the
    // affordance pipeline), not pointer.onDown. The dispatcher walks the
    // active tool's overlay layers and routes the resulting drag channel
    // for the gesture. We invoke the overlay's hitTest directly with the
    // ChromeState shape it expects.
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: (id) => (id === 'obj1' ? { x: 0, y: 0, width: 100, height: 100 } : null),
        handleHitRadius: 10,
      }),
    );
    const chromeState = {
      selection: ['obj1'],
      multiActive: false,
      unionBounds: null,
      boundsOf: (id: string) => (id === 'obj1' ? { x: 0, y: 0, width: 100, height: 100 } : null),
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    } as any;
    const view = { x: 0, y: 0, scale: 1 };
    const dims = { width: 200, height: 200 };
    const hit = result.current.overlay!.hitTest!(0, 0, chromeState, view, dims);
    expect(hit).not.toBeNull();
    expect(hit!.initialScratch).toEqual(expect.objectContaining({ targetId: 'obj1' }));
    expect(typeof hit!.drag.onStart).toBe('function');
  });

  it('overlay.hitTest: handleHitRadius is screen-px (scale=2 halves world hit radius)', () => {
    // 100×100 object at (0,0). handleHitRadius=10 screen px → 5 world at
    // scale=2. cornerHandle hit-test uses max-norm; worldX=6 is outside the
    // 5-world half-extent on the X axis (miss). worldX=4 is inside (hit).
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: (id) => (id === 'obj1' ? { x: 0, y: 0, width: 100, height: 100 } : null),
        handleHitRadius: 10,
      }),
    );
    const chromeState = {
      selection: ['obj1'],
      multiActive: false,
      unionBounds: null,
      boundsOf: (id: string) => (id === 'obj1' ? { x: 0, y: 0, width: 100, height: 100 } : null),
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    } as any;
    const view = { x: 0, y: 0, scale: 2 };
    const dims = { width: 200, height: 200 };
    expect(result.current.overlay!.hitTest!(6, 0, chromeState, view, dims)).toBeNull();
    expect(result.current.overlay!.hitTest!(4, 0, chromeState, view, dims)).not.toBeNull();
  });

  it('drag.onStart after body-hit routes to move controller (claims)', () => {
    const ctx = ctxOver({
      selection: { current: ['hit-id'], applyClick: vi.fn(), set: vi.fn(), clear: vi.fn() } as any,
      scratch: { kind: 'move', ids: ['hit-id'], deferredClickId: null },
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => ['hit-id'],
        boundsOf: () => null,
      }),
    );
    const decision = result.current.drag!.onStart!(pe(), ctx);
    expect(decision).toBe('claim');
  });

  it('drag.onStart after area-hit routes to areaSelect controller (claims)', () => {
    const ctx = ctxOver({
      scratch: { kind: 'area' },
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    const decision = result.current.drag!.onStart!(pe(), ctx);
    expect(decision).toBe('claim');
  });

  it('works with an adapter missing AreaSelectAdapter methods (no marquee wiring)', () => {
    // No hitTestArea/getSelection/setSelection/applyOps — should not throw on
    // mount, and an empty-space drag should not crash on end.
    const flatAdapter = {
      getNode: (id: string) => ({ id }),
      getNodes: () => [],
      getPose: (_id: string) => ({ x: 0, y: 0, width: 10, height: 10 }),
      setPose: vi.fn(),
      // no getParent, setParent, hitTestArea, getSelection, setSelection, applyOps
    } as any;
    const { result } = renderHook(() =>
      useSelectTool(flatAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    // Empty-space drag start → move → end should all be safe.
    act(() => {
      const c1 = ctxOver({ scratch: { kind: 'area' }, worldX: 0, worldY: 0 });
      result.current.drag!.onStart!(pe(), c1);
      const c2 = ctxOver({ scratch: { kind: 'area' }, worldX: 50, worldY: 30 });
      result.current.drag!.onMove!(pe(), c2);
      const c3 = ctxOver({ scratch: { kind: 'area' }, worldX: 50, worldY: 30 });
      result.current.drag!.onEnd!(pe(), c3);
    });
    // Empty-click clear path still works (uses ctx.selection, not adapter).
    const clear = vi.fn();
    const ctx = ctxOver({
      selection: { current: ['a'], applyClick: vi.fn(), set: vi.fn(), clear } as any,
    });
    result.current.pointer!.onDown!(pe(), ctx);
    result.current.pointer!.onClick!(pe(), ctx);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('drag.onEnd claims for active scratch kinds', () => {
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    for (const scratch of [
      { kind: 'move', ids: ['a'], deferredClickId: null },
      { kind: 'area' },
    ] as SelectScratch[]) {
      const ctx = ctxOver({ scratch });
      const decision = result.current.drag!.onEnd!(pe(), ctx);
      expect(decision).toBe('claim');
    }
  });
});

import { createDebugSink } from '../../debug/createDebugSink';

describe('useSelectTool — debug recording', () => {
  it('does not record handle hitboxes in pointer.onDown after the affordance migration', () => {
    // Task 11 moved corner-handle hits to the affordance pipeline; Task 14
    // moved rotation-handle hits the same way. Both inline
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
      selection: { current: ['a'], applyClick: vi.fn(), set: vi.fn(), clear: vi.fn() } as any,
    });
    result.current.pointer!.onDown!(pe(), ctx);
    const hits = sink.snapshot().hitboxes;
    expect(hits.filter((h) => h.kind === 'rotation')).toHaveLength(0);
    expect(hits.filter((h) => h.kind === 'handle')).toHaveLength(0);
  });
});

describe('useSelectTool overlay', () => {
  const adapterFor = (over: Partial<any> = {}) =>
    ({
      getNode: (id: string) => ({ id, x: 0, y: 0, width: 10, height: 10 }),
      getNodes: () => [{ id: 'obj1', x: 0, y: 0, width: 10, height: 10 }],
      getPose: (_id: string) => ({ x: 0, y: 0, width: 10, height: 10 }),
      getParent: (_id: string) => null,
      setPose: vi.fn(),
      setParent: vi.fn(),
      hitTestArea: () => [],
      getSelection: () => [],
      setSelection: vi.fn(),
      applyOps: vi.fn(),
      ...over,
    }) as any;

  const VIEW = { x: 0, y: 0, scale: 1 };
  const DIMS = { width: 100, height: 100 };

  it('publishes a RenderLayer on the Tool record', () => {
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    expect(result.current.overlay).toBeDefined();
    expect(result.current.overlay!.id).toBe('select-overlay');
    expect(result.current.overlay!.space).toBe('screen');
  });

  it('emits no commands when scratch is idle (no sub-controller engaged)', () => {
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        pickEvery: () => [],
        boundsOf: () => null,
        getNode: (id) => ({ id, x: 0, y: 0, width: 10, height: 10 }) as any,
      }),
    );
    const cmds = result.current.overlay!.draw(undefined, VIEW, DIMS);
    expect(cmds).toEqual([]);
  });

  it('area-select marquee emits a path command during area-select gesture', () => {
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        pickEvery: () => [],
        boundsOf: () => null,
      }),
    );
    act(() => {
      const ctx = ctxOver({ scratch: { kind: 'area' }, worldX: 0, worldY: 0 });
      result.current.drag!.onStart!(pe(), ctx);
      result.current.drag!.onMove!(pe(), ctxOver({ scratch: { kind: 'area' }, worldX: 50, worldY: 30 }));
    });
    const cmds = result.current.overlay!.draw(undefined, VIEW, DIMS);
    expect(cmds.length).toBeGreaterThan(0);
    expect(cmds[0].kind).toBe('path');
  });

  it('area-select marquee respects style overrides', () => {
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        pickEvery: () => [],
        boundsOf: () => null,
        areaSelectOverlayStyle: { fill: '#abc', stroke: '#def', dash: [5, 5], lineWidth: 3 },
      }),
    );
    act(() => {
      result.current.drag!.onStart!(pe(), ctxOver({ scratch: { kind: 'area' }, worldX: 0, worldY: 0 }));
      result.current.drag!.onMove!(pe(), ctxOver({ scratch: { kind: 'area' }, worldX: 5, worldY: 5 }));
    });
    const cmds = result.current.overlay!.draw(undefined, VIEW, DIMS);
    const first = cmds[0] as { fill?: { color?: string }; stroke?: { paint?: { color?: string }; width?: number } };
    expect(first.fill?.color).toBe('#abc');
    expect(first.stroke?.paint?.color).toBe('#def');
    expect(first.stroke?.width).toBe(3);
  });

  it('move ghost calls drawGhost for each id in move.overlay.poses', () => {
    const drawGhost = vi.fn((..._args: unknown[]) => [] as any[]);
    const getNode = vi.fn((id: string) => ({ id, x: 0, y: 0, width: 10, height: 10 }) as any);
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        pickEvery: () => ['a', 'b'],
        boundsOf: () => null,
        drawGhost,
        getNode,
      }),
    );
    act(() => {
      const c1 = ctxOver({ scratch: { kind: 'move', ids: ['a', 'b'], deferredClickId: null }, worldX: 0, worldY: 0 });
      result.current.drag!.onStart!(pe({ clientX: 0, clientY: 0 }), c1);
      const c2 = ctxOver({ scratch: { kind: 'move', ids: ['a', 'b'], deferredClickId: null }, worldX: 20, worldY: 20 });
      result.current.drag!.onMove!(pe({ clientX: 50, clientY: 50 }), c2);
    });
    result.current.overlay!.draw(undefined, VIEW, DIMS);
    expect(drawGhost).toHaveBeenCalledTimes(2);
  });

  it('move ghost skips silently when drawGhost or getNode are missing', () => {
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        pickEvery: () => ['a'],
        boundsOf: () => null,
      }),
    );
    act(() => {
      result.current.drag!.onStart!(
        pe({ clientX: 0, clientY: 0 }),
        ctxOver({ scratch: { kind: 'move', ids: ['a'], deferredClickId: null }, worldX: 0, worldY: 0 }),
      );
      result.current.drag!.onMove!(
        pe({ clientX: 50, clientY: 50 }),
        ctxOver({ scratch: { kind: 'move', ids: ['a'], deferredClickId: null }, worldX: 20, worldY: 20 }),
      );
    });
    expect(() => result.current.overlay!.draw(undefined, VIEW, DIMS)).not.toThrow();
  });

  it('resize ghost calls drawGhost once with resize.overlay.currentPose', () => {
    const drawGhost = vi.fn((..._args: unknown[]) => [] as any[]);
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        pickEvery: () => [],
        boundsOf: () => ({ x: 0, y: 0, width: 100, height: 100 }),
        drawGhost,
        getNode: (id) => ({ id, x: 0, y: 0, width: 100, height: 100 }) as any,
      }),
    );
    act(() => {
      result.current.drag!.onStart!(
        pe(),
        ctxOver({
          scratch: { kind: 'resize', targetId: 'obj1', anchor: { x: 'min', y: 'min' } },
          worldX: 100,
          worldY: 100,
        }),
      );
    });
    result.current.overlay!.draw(undefined, VIEW, DIMS);
    expect(drawGhost).toHaveBeenCalledTimes(1);
    expect(drawGhost.mock.calls[0][1]).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('rotate ghost calls drawGhost once with rotate.overlay.currentPose', () => {
    const drawGhost = vi.fn((..._args: unknown[]) => [] as any[]);
    const { result } = renderHook(() =>
      useSelectTool(adapterFor({
        getPose: (_id: string) => ({ x: 0, y: 0, width: 10, height: 10, rotation: 0 }),
        getNode: (id: string) => ({ id, x: 0, y: 0, width: 10, height: 10, rotation: 0 }),
      }), {
        pickEvery: () => [],
        boundsOf: () => ({ x: 0, y: 0, width: 100, height: 100 }),
        drawGhost,
        getNode: (id) => ({ id, x: 0, y: 0, width: 10, height: 10, rotation: 0 }) as any,
      }),
    );
    act(() => {
      result.current.drag!.onStart!(
        pe(),
        ctxOver({
          scratch: { kind: 'rotate', targetId: 'obj1' },
          worldX: 50,
          worldY: 0,
        }),
      );
    });
    result.current.overlay!.draw(undefined, VIEW, DIMS);
    expect(drawGhost).toHaveBeenCalledTimes(1);
    expect(drawGhost.mock.calls[0][1]).toMatchObject({ rotation: 0 });
  });

  it('moveOverlayStyle.ghostAlpha overrides default 0.85', () => {
    const drawGhost = vi.fn(() => [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
      fill: { color: '#000' },
    } as const]);
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        pickEvery: () => ['a'],
        boundsOf: () => null,
        drawGhost,
        getNode: (id) => ({ id, x: 0, y: 0, width: 10, height: 10 }) as any,
        moveOverlayStyle: { ghostAlpha: 0.5 },
      }),
    );
    act(() => {
      result.current.drag!.onStart!(
        pe({ clientX: 0, clientY: 0 }),
        ctxOver({ scratch: { kind: 'move', ids: ['a'], deferredClickId: null }, worldX: 0, worldY: 0 }),
      );
      result.current.drag!.onMove!(
        pe({ clientX: 50, clientY: 50 }),
        ctxOver({ scratch: { kind: 'move', ids: ['a'], deferredClickId: null }, worldX: 20, worldY: 20 }),
      );
    });
    const cmds = result.current.overlay!.draw(undefined, VIEW, DIMS);
    // Ghost output is wrapped in a group with the alpha override.
    expect(cmds.length).toBe(1);
    const group = cmds[0] as { kind: string; alpha?: number };
    expect(group.kind).toBe('group');
    expect(group.alpha).toBe(0.5);
  });
});
