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
    applyBatch: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: { kind: 'idle' },
    ...over,
  };
}

const minimalAdapter = {
  // MoveAdapter
  getObject: (id: string) => ({ id }),
  getObjects: () => [],
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
        hitBody: () => [],
        boundsOf: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      }),
    );
    expect(result.current.id).toBe('select');
    expect(result.current.keybinding).toBe('V');
    expect(result.current.cursor).toBe('default');
  });

  it('pointer.onDown over body stashes kind:move and selects', () => {
    const applyClick = vi.fn();
    const ctx = ctxOver({
      selection: { current: ['hit-id'], applyClick, set: vi.fn(), clear: vi.fn() } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => ['hit-id'],
        boundsOf: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(ctx.scratch).toEqual(expect.objectContaining({ kind: 'move' }));
    expect(applyClick).toHaveBeenCalledWith('hit-id', ctx.modifiers);
  });

  it('pointer.onDown picks the child over its container when both are in hitBody', () => {
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
        hitBody: () => ['F', 'f1'], // parent before child — buggy demo order
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
        hitBody: () => [],
        boundsOf: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(ctx.scratch).toEqual({ kind: 'area' });
  });

  it('pointer.onDown over empty clears selection (Figma-style click-empty deselects)', () => {
    const clear = vi.fn();
    const ctx = ctxOver({
      selection: { current: ['a', 'b'], applyClick: vi.fn(), set: vi.fn(), clear } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => [],
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('pointer.onDown over empty with shift held does NOT clear selection (extend-marquee path)', () => {
    const clear = vi.fn();
    const ctx = ctxOver({
      modifiers: { alt: false, shift: true, meta: false, ctrl: false, space: false },
      selection: { current: ['a', 'b'], applyClick: vi.fn(), set: vi.fn(), clear } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => [],
        boundsOf: () => null,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(clear).not.toHaveBeenCalled();
  });

  it('initScratch returns kind:idle', () => {
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => [],
        boundsOf: () => null,
      }),
    );
    expect(result.current.initScratch!()).toEqual({ kind: 'idle' });
  });

  it('pointer.onDown over resize handle stashes kind:resize', () => {
    // Single selected object with known bounds — pointer directly on top-left corner handle
    const ctx = ctxOver({
      worldX: 0,
      worldY: 0,
      selection: { current: ['obj1'], applyClick: vi.fn(), set: vi.fn(), clear: vi.fn() } as any,
      scratch: { kind: 'idle' },
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => [],
        boundsOf: (id) => id === 'obj1' ? { x: 0, y: 0, width: 100, height: 100 } : null,
        handleHitRadius: 10,
      }),
    );
    result.current.pointer!.onDown!(pe({ clientX: 0, clientY: 0 }), ctx);
    expect(ctx.scratch).toEqual(expect.objectContaining({ kind: 'resize', targetId: 'obj1' }));
  });

  it('handleHitRadius is screen-px: scale=2 halves the world hit radius', () => {
    // 100×100 object at (0,0). handleHitRadius=10 screen px → 5 world at
    // scale=2. cornerHandle hit-test uses max-norm; worldX=6 puts the pointer
    // outside the 5-world half-extent on the X axis. Should miss.
    const ctxMiss = ctxOver({
      worldX: 6,
      worldY: 0,
      view: { x: 0, y: 0, scale: 2 },
      selection: { current: ['obj1'], applyClick: vi.fn(), set: vi.fn(), clear: vi.fn() } as any,
      scratch: { kind: 'idle' },
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => [],
        boundsOf: (id) => (id === 'obj1' ? { x: 0, y: 0, width: 100, height: 100 } : null),
        handleHitRadius: 10,
      }),
    );
    result.current.pointer!.onDown!(pe(), ctxMiss);
    expect(ctxMiss.scratch).toEqual({ kind: 'area' });

    // worldX=4, worldY=0 → both within 5 half-extent. Should hit.
    const ctxHit = ctxOver({
      worldX: 4,
      worldY: 0,
      view: { x: 0, y: 0, scale: 2 },
      selection: { current: ['obj1'], applyClick: vi.fn(), set: vi.fn(), clear: vi.fn() } as any,
      scratch: { kind: 'idle' },
    });
    result.current.pointer!.onDown!(pe(), ctxHit);
    expect(ctxHit.scratch).toEqual(expect.objectContaining({ kind: 'resize', targetId: 'obj1' }));
  });

  it('drag.onStart after body-hit routes to move controller (claims)', () => {
    const ctx = ctxOver({
      selection: { current: ['hit-id'], applyClick: vi.fn(), set: vi.fn(), clear: vi.fn() } as any,
      scratch: { kind: 'move', ids: ['hit-id'] },
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => ['hit-id'],
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
        hitBody: () => [],
        boundsOf: () => null,
      }),
    );
    const decision = result.current.drag!.onStart!(pe(), ctx);
    expect(decision).toBe('claim');
  });

  it('drag.onEnd claims for active scratch kinds', () => {
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => [],
        boundsOf: () => null,
      }),
    );
    for (const scratch of [
      { kind: 'move', ids: ['a'] },
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
  it('records corner-handle hitboxes during pointer-down hit-test', () => {
    const sink = createDebugSink({ hitboxes: true });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => [],
        boundsOf: () => ({ x: 0, y: 0, width: 40, height: 30 }),
        debug: sink,
      }),
    );
    const ctx = ctxOver({
      selection: { current: ['a'], applyClick: vi.fn(), set: vi.fn(), clear: vi.fn() } as any,
    });
    result.current.pointer!.onDown!(pe(), ctx);
    const hits = sink.snapshot().hitboxes;
    const handles = hits.filter((h) => h.kind === 'handle');
    const rotations = hits.filter((h) => h.kind === 'rotation');
    expect(handles.length).toBe(4);
    expect(rotations.length).toBe(1);
  });
});

function ctxStub() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('useSelectTool overlay', () => {
  const adapterFor = (over: Partial<any> = {}) =>
    ({
      getObject: (id: string) => ({ id, x: 0, y: 0, width: 10, height: 10 }),
      getObjects: () => [{ id: 'obj1', x: 0, y: 0, width: 10, height: 10 }],
      getPose: (_id: string) => ({ x: 0, y: 0, width: 10, height: 10 }),
      getParent: (_id: string) => null,
      setPose: vi.fn(),
      setParent: vi.fn(),
      hitTestArea: () => [],
      getSelection: () => [],
      setSelection: vi.fn(),
      applyOps: vi.fn(),
      applyBatch: vi.fn(),
      ...over,
    }) as any;

  it('publishes a RenderLayer on the Tool record', () => {
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        hitBody: () => [],
        boundsOf: () => null,
      }),
    );
    expect(result.current.overlay).toBeDefined();
    expect(result.current.overlay!.id).toBe('select-overlay');
    expect(result.current.overlay!.space).toBe('screen');
  });

  it('renders nothing when scratch is idle (no sub-controller engaged)', () => {
    const drawGhost = vi.fn();
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        hitBody: () => [],
        boundsOf: () => null,
        drawGhost,
        getObject: (id) => ({ id, x: 0, y: 0, width: 10, height: 10 }) as any,
      }),
    );
    const ctx = ctxStub();
    result.current.overlay!.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
    expect(drawGhost).not.toHaveBeenCalled();
  });

  it('area-select marquee renders during area-select gesture', () => {
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        hitBody: () => [],
        boundsOf: () => null,
      }),
    );
    act(() => {
      const ctx = ctxOver({ scratch: { kind: 'area' }, worldX: 0, worldY: 0 });
      result.current.drag!.onStart!(pe(), ctx);
      result.current.drag!.onMove!(pe(), ctxOver({ scratch: { kind: 'area' }, worldX: 50, worldY: 30 }));
    });
    const ctx = ctxStub();
    result.current.overlay!.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it('area-select marquee respects style overrides', () => {
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        hitBody: () => [],
        boundsOf: () => null,
        areaSelectOverlayStyle: { fill: '#abc', stroke: '#def', dash: [5, 5], lineWidth: 3 },
      }),
    );
    act(() => {
      result.current.drag!.onStart!(pe(), ctxOver({ scratch: { kind: 'area' }, worldX: 0, worldY: 0 }));
      result.current.drag!.onMove!(pe(), ctxOver({ scratch: { kind: 'area' }, worldX: 5, worldY: 5 }));
    });
    const ctx = ctxStub();
    result.current.overlay!.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect((ctx as any).fillStyle).toBe('#abc');
    expect((ctx as any).strokeStyle).toBe('#def');
    expect((ctx as any).lineWidth).toBe(3);
  });

  it('move ghost calls drawGhost for each id in move.overlay.poses', () => {
    const drawGhost = vi.fn();
    const getObject = vi.fn((id: string) => ({ id, x: 0, y: 0, width: 10, height: 10 }) as any);
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        hitBody: () => ['a', 'b'],
        boundsOf: () => null,
        drawGhost,
        getObject,
      }),
    );
    act(() => {
      // start a move with two ids; need to push past drag threshold (4px default)
      const c1 = ctxOver({ scratch: { kind: 'move', ids: ['a', 'b'] }, worldX: 0, worldY: 0 });
      result.current.drag!.onStart!(pe({ clientX: 0, clientY: 0 }), c1);
      const c2 = ctxOver({ scratch: { kind: 'move', ids: ['a', 'b'] }, worldX: 20, worldY: 20 });
      result.current.drag!.onMove!(pe({ clientX: 50, clientY: 50 }), c2);
    });
    const ctx = ctxStub();
    result.current.overlay!.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(drawGhost).toHaveBeenCalledTimes(2);
    // globalAlpha was set inside save/restore
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('move ghost skips silently when drawGhost or getObject are missing', () => {
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        hitBody: () => ['a'],
        boundsOf: () => null,
        // no drawGhost, no getObject
      }),
    );
    act(() => {
      result.current.drag!.onStart!(
        pe({ clientX: 0, clientY: 0 }),
        ctxOver({ scratch: { kind: 'move', ids: ['a'] }, worldX: 0, worldY: 0 }),
      );
      result.current.drag!.onMove!(
        pe({ clientX: 50, clientY: 50 }),
        ctxOver({ scratch: { kind: 'move', ids: ['a'] }, worldX: 20, worldY: 20 }),
      );
    });
    const ctx = ctxStub();
    expect(() =>
      result.current.overlay!.draw(ctx, undefined, { x: 0, y: 0, scale: 1 }),
    ).not.toThrow();
  });

  it('resize ghost calls drawGhost once with resize.overlay.currentPose', () => {
    const drawGhost = vi.fn();
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        hitBody: () => [],
        boundsOf: () => ({ x: 0, y: 0, width: 100, height: 100 }),
        drawGhost,
        getObject: (id) => ({ id, x: 0, y: 0, width: 100, height: 100 }) as any,
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
    const ctx = ctxStub();
    result.current.overlay!.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(drawGhost).toHaveBeenCalledTimes(1);
    // pose passed should be the currentPose (origin pose at start)
    expect(drawGhost.mock.calls[0][2]).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('rotate ghost calls drawGhost once with rotate.overlay.currentPose', () => {
    const drawGhost = vi.fn();
    const { result } = renderHook(() =>
      useSelectTool(adapterFor({
        getPose: (_id: string) => ({ x: 0, y: 0, width: 10, height: 10, rotation: 0 }),
        getObject: (id: string) => ({ id, x: 0, y: 0, width: 10, height: 10, rotation: 0 }),
      }), {
        hitBody: () => [],
        boundsOf: () => ({ x: 0, y: 0, width: 100, height: 100 }),
        drawGhost,
        getObject: (id) => ({ id, x: 0, y: 0, width: 10, height: 10, rotation: 0 }) as any,
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
    const ctx = ctxStub();
    result.current.overlay!.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(drawGhost).toHaveBeenCalledTimes(1);
    expect(drawGhost.mock.calls[0][2]).toMatchObject({ rotation: 0 });
  });

  it('moveOverlayStyle.ghostAlpha overrides default 0.85', () => {
    let observedAlpha = -1;
    const drawGhost = vi.fn((ctx: CanvasRenderingContext2D) => {
      observedAlpha = (ctx as any).globalAlpha;
    });
    const { result } = renderHook(() =>
      useSelectTool(adapterFor(), {
        hitBody: () => ['a'],
        boundsOf: () => null,
        drawGhost,
        getObject: (id) => ({ id, x: 0, y: 0, width: 10, height: 10 }) as any,
        moveOverlayStyle: { ghostAlpha: 0.5 },
      }),
    );
    act(() => {
      result.current.drag!.onStart!(
        pe({ clientX: 0, clientY: 0 }),
        ctxOver({ scratch: { kind: 'move', ids: ['a'] }, worldX: 0, worldY: 0 }),
      );
      result.current.drag!.onMove!(
        pe({ clientX: 50, clientY: 50 }),
        ctxOver({ scratch: { kind: 'move', ids: ['a'] }, worldX: 20, worldY: 20 }),
      );
    });
    const ctx = ctxStub();
    result.current.overlay!.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(observedAlpha).toBe(0.5);
  });
});
