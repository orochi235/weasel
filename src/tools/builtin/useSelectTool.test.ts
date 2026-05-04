import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
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
  it('declares id "select" and default cursor', () => {
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => [],
        boundsOf: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      }),
    );
    expect(result.current.id).toBe('select');
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
