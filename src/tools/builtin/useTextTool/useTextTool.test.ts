import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextTool } from './useTextTool';
import { makeCtx, pe } from '../testUtils';

// Empty-canvas hit-target — required by the declarative-routing factory's
// pointer.onClick path, which gates on ctx.target. The dispatcher
// synthesizes this in production; unit tests pass it explicitly.
const EMPTY_TARGET = { category: 'empty', kind: 'empty' } as const;

describe('useTextTool — declarations', () => {
  it('declares id "text", T keybinding, text cursor', () => {
    const { result } = renderHook(() =>
      useTextTool({ pointInsert: () => ({ id: 't', x: 0, y: 0, width: 0, height: 0, text: '' }) }),
    );
    expect(result.current.id).toBe('text');
    expect(result.current.keybinding).toEqual({ key: 'T' });
    // Declarative routing factory always emits cursor as a function.
    const cursor = typeof result.current.cursor === 'function'
      ? (result.current.cursor as (c: any) => string)(makeCtx())
      : result.current.cursor;
    expect(cursor).toBe('text');
  });

  it('has no drag handlers when commitInsert is omitted (click-only)', () => {
    const { result } = renderHook(() =>
      useTextTool({ pointInsert: () => ({ id: 't', x: 0, y: 0, width: 0, height: 0, text: '' }) }),
    );
    expect(result.current.drag).toBeUndefined();
  });

  it('has drag handlers and overlay when commitInsert is supplied', () => {
    const { result } = renderHook(() =>
      useTextTool({
        pointInsert: () => ({ id: 't', x: 0, y: 0, width: 0, height: 0, text: '' }),
        commitInsert: (b) => ({ id: 't', ...b, text: '' }),
      }),
    );
    expect(result.current.drag).toBeDefined();
    expect(result.current.overlay).toBeDefined();
    expect(result.current.overlay!.space).toBe('screen');
  });
});

describe('useTextTool — click path', () => {
  it('pointer.onClick on empty space dispatches an InsertOp via applyOps', () => {
    const pointInsert = vi.fn((p: { x: number; y: number }) => ({
      id: 't1', x: p.x, y: p.y, width: 120, height: 32, text: '',
    }));
    const applyOps = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert }));
    let decision: unknown;
    act(() => {
      decision = result.current.pointer!.onClick!(pe(), makeCtx({ worldX: 50, worldY: 75, applyOps, target: EMPTY_TARGET }));
    });
    expect(decision).toBe('claim');
    expect(pointInsert).toHaveBeenCalledWith({ x: 50, y: 75 });
    expect(applyOps).toHaveBeenCalledTimes(1);
    const [ops, label] = applyOps.mock.calls[0] as [Array<{ apply: unknown; invert: unknown }>, string];
    expect(label).toBe('Insert text');
    expect(ops.length).toBe(1);
  });

  it('pointer.onClick with pointInsert returning null is a claim with no batch', () => {
    const pointInsert = vi.fn(() => null);
    const applyOps = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert }));
    let decision: unknown;
    act(() => {
      decision = result.current.pointer!.onClick!(pe(), makeCtx({ applyOps, target: EMPTY_TARGET }));
    });
    expect(decision).toBe('claim');
    expect(applyOps).not.toHaveBeenCalled();
  });

  it('pointer.onClick with hitExisting hit selects and skips insertion', () => {
    const pointInsert = vi.fn();
    const set = vi.fn();
    const hitExisting = vi.fn(() => 'existing-1');
    const applyOps = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert, hitExisting }));
    let decision: unknown;
    act(() => {
      decision = result.current.pointer!.onClick!(
        pe(),
        makeCtx({ applyOps, selection: { current: [], set } as any, target: EMPTY_TARGET }),
      );
    });
    expect(decision).toBe('claim');
    expect(set).toHaveBeenCalledWith(['existing-1']);
    expect(pointInsert).not.toHaveBeenCalled();
    expect(applyOps).not.toHaveBeenCalled();
  });
});

describe('useTextTool — dispatch routing', () => {
  it('routes commit dispatch through ctx.applyOps (not adapter/applyOpsTo)', () => {
    const pointInsert = vi.fn(() => ({ id: 't1', x: 5, y: 6, width: 10, height: 10, text: '' }));
    const ctxApplyBatch = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert }));
    act(() => {
      result.current.pointer!.onClick!(pe(), makeCtx({ applyOps: ctxApplyBatch, worldX: 5, worldY: 6, target: EMPTY_TARGET }));
    });
    expect(ctxApplyBatch).toHaveBeenCalledTimes(1);
    const [ops, label] = ctxApplyBatch.mock.calls[0] as [unknown[], string];
    expect(label).toBe('Insert text');
    expect(ops.length).toBe(1);
  });

  it('captures ctx.applyOps fresh per handler entry (no stale ref across invocations)', () => {
    const pointInsert = vi.fn(() => ({ id: 't1', x: 0, y: 0, width: 10, height: 10, text: '' }));
    const first = vi.fn();
    const second = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert }));
    act(() => {
      result.current.pointer!.onClick!(pe(), makeCtx({ applyOps: first, target: EMPTY_TARGET }));
      result.current.pointer!.onClick!(pe(), makeCtx({ applyOps: second, target: EMPTY_TARGET }));
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('useTextTool — drag path', () => {
  it('drag above threshold commits via commitInsert', () => {
    const pointInsert = vi.fn();
    const commitInsert = vi.fn((b: { x: number; y: number; width: number; height: number }) => ({
      id: 't1', x: b.x, y: b.y, width: b.width, height: b.height, text: '',
    }));
    const applyOps = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert, commitInsert }));
    const ctx = makeCtx({ applyOps, worldX: 10, worldY: 20 });
    act(() => {
      result.current.drag!.onStart!(pe(), ctx);
      ctx.worldX = 110;
      ctx.worldY = 80;
      result.current.drag!.onMove!(pe(), ctx);
      result.current.drag!.onEnd!(pe(), ctx);
    });
    expect(commitInsert).toHaveBeenCalledWith({ x: 10, y: 20, width: 100, height: 60 });
    expect(pointInsert).not.toHaveBeenCalled();
    expect(applyOps).toHaveBeenCalledTimes(1);
  });

  it('drag below threshold falls back to pointInsert at the start point', () => {
    const pointInsert = vi.fn(() => ({ id: 't1', x: 10, y: 20, width: 0, height: 0, text: '' }));
    const commitInsert = vi.fn();
    const applyOps = vi.fn();
    const { result } = renderHook(() =>
      useTextTool({ pointInsert, commitInsert, minBounds: { width: 10, height: 10 } }),
    );
    const ctx = makeCtx({ applyOps, worldX: 10, worldY: 20 });
    act(() => {
      result.current.drag!.onStart!(pe(), ctx);
      ctx.worldX = 12;
      ctx.worldY = 21;
      result.current.drag!.onMove!(pe(), ctx);
      result.current.drag!.onEnd!(pe(), ctx);
    });
    expect(commitInsert).not.toHaveBeenCalled();
    expect(pointInsert).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(applyOps).toHaveBeenCalledTimes(1);
  });

  it('drag.onStart with hitExisting hit selects and does not start the controller', () => {
    const pointInsert = vi.fn();
    const commitInsert = vi.fn();
    const set = vi.fn();
    const hitExisting = vi.fn(() => 'hit-1');
    const applyOps = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert, commitInsert, hitExisting }));
    const ctx = makeCtx({ applyOps, worldX: 10, worldY: 20, selection: { current: [], set } as any });
    let decision: unknown;
    act(() => {
      decision = result.current.drag!.onStart!(pe(), ctx);
      result.current.drag!.onMove!(pe(), ctx);
      result.current.drag!.onEnd!(pe(), ctx);
    });
    expect(decision).toBe('claim');
    expect(set).toHaveBeenCalledWith(['hit-1']);
    expect(commitInsert).not.toHaveBeenCalled();
    expect(pointInsert).not.toHaveBeenCalled();
    expect(applyOps).not.toHaveBeenCalled();
  });
});
