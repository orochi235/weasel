import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInsertTool } from './useInsertTool';
import { makeCtx, pe } from './testUtils';

describe('useInsertTool', () => {
  const baseAdapter = {
    getSelection: () => [],
    commitInsert: vi.fn((bounds: any) => ({ id: 'new', ...bounds })),
    commitPaste: vi.fn(() => []),
    snapshotSelection: vi.fn(),
    insertObject: vi.fn(),
    setSelection: vi.fn(),
    applyBatch: vi.fn(),
  } as any;

  const opts = {
    // no extra options needed
  };

  it('declares id "insert" and crosshair cursor', () => {
    const { result } = renderHook(() => useInsertTool(baseAdapter, opts));
    expect(result.current.id).toBe('insert');
    expect(result.current.cursor).toBe('crosshair');
  });

  it('has no keybinding declared', () => {
    const { result } = renderHook(() => useInsertTool(baseAdapter, opts));
    expect(result.current.keybinding).toBeUndefined();
  });

  it('drag.onStart claims and starts the insert controller', () => {
    const { result } = renderHook(() => useInsertTool(baseAdapter, opts));
    const decision = result.current.drag!.onStart!(pe(), makeCtx());
    expect(decision).toBe('claim');
  });

  it('drag.onMove claims and forwards', () => {
    const { result } = renderHook(() => useInsertTool(baseAdapter, opts));
    result.current.drag!.onStart!(pe(), makeCtx());
    const decision = result.current.drag!.onMove!(pe(), makeCtx({ worldX: 50, worldY: 60 }));
    expect(decision).toBe('claim');
  });

  it('drag.onEnd commits via the wrapped controller', () => {
    const applyBatch = vi.fn();
    const commitInsert = vi.fn(() => ({ id: 'new', x: 0, y: 0, width: 50, height: 50 }));
    const adapter = {
      getSelection: () => [],
      commitInsert,
      commitPaste: vi.fn(() => []),
      snapshotSelection: vi.fn(),
      insertObject: vi.fn(),
      setSelection: vi.fn(),
      applyBatch,
    } as any;
    const { result } = renderHook(() => useInsertTool(adapter, {}));
    result.current.drag!.onStart!(pe(), makeCtx({ worldX: 0, worldY: 0 }));
    result.current.drag!.onMove!(pe(), makeCtx({ worldX: 50, worldY: 50 }));
    result.current.drag!.onEnd!(pe(), makeCtx({ worldX: 50, worldY: 50 }));
    expect(commitInsert).toHaveBeenCalledTimes(1);
    expect(applyBatch).toHaveBeenCalledTimes(1);
  });

  it('routes commit dispatch through adapter.applyBatch (not ctx.applyBatch)', () => {
    const adapterApplyBatch = vi.fn();
    const ctxApplyBatch = vi.fn();
    const adapter = {
      getSelection: () => [],
      commitInsert: vi.fn(() => ({ id: 'new', x: 0, y: 0, width: 50, height: 50 })),
      commitPaste: vi.fn(() => []),
      snapshotSelection: vi.fn(),
      insertObject: vi.fn(),
      setSelection: vi.fn(),
      applyBatch: adapterApplyBatch,
    } as any;
    const { result } = renderHook(() => useInsertTool(adapter, {}));
    result.current.drag!.onStart!(pe(), makeCtx({ worldX: 0, worldY: 0, applyBatch: ctxApplyBatch }));
    result.current.drag!.onMove!(pe(), makeCtx({ worldX: 50, worldY: 50, applyBatch: ctxApplyBatch }));
    result.current.drag!.onEnd!(pe(), makeCtx({ worldX: 50, worldY: 50, applyBatch: ctxApplyBatch }));
    expect(adapterApplyBatch).toHaveBeenCalledTimes(1);
    expect(ctxApplyBatch).not.toHaveBeenCalled();
  });

  it('drag.onEnd returns "claim"', () => {
    const { result } = renderHook(() => useInsertTool(baseAdapter, opts));
    result.current.drag!.onStart!(pe(), makeCtx({ worldX: 0, worldY: 0 }));
    result.current.drag!.onMove!(pe(), makeCtx({ worldX: 50, worldY: 50 }));
    const decision = result.current.drag!.onEnd!(pe(), makeCtx({ worldX: 50, worldY: 50 }));
    expect(decision).toBe('claim');
  });
});

function ctxStub() {
  return {
    save: vi.fn(), restore: vi.fn(),
    fillRect: vi.fn(), strokeRect: vi.fn(),
    setLineDash: vi.fn(), scale: vi.fn(), translate: vi.fn(),
    fillStyle: '', strokeStyle: '', lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('useInsertTool — opt-in click + hitExisting', () => {
  it('registers pointer.onClick when pointInsert is supplied', () => {
    const adapter = {
      getSelection: () => [],
      commitInsert: vi.fn(),
      commitPaste: vi.fn(() => []),
      snapshotSelection: vi.fn(),
      insertObject: vi.fn(),
      setSelection: vi.fn(),
      applyBatch: vi.fn(),
    } as any;
    const { result } = renderHook(() =>
      useInsertTool(adapter, {
        pointInsert: (p) => ({ id: 'i', x: p.x, y: p.y, width: 0, height: 0 }),
      }),
    );
    expect(result.current.pointer?.onClick).toBeDefined();
  });

  it('does not register pointer.onClick when pointInsert is omitted', () => {
    const adapter = {
      getSelection: () => [],
      commitInsert: vi.fn(),
      commitPaste: vi.fn(() => []),
      snapshotSelection: vi.fn(),
      insertObject: vi.fn(),
      setSelection: vi.fn(),
      applyBatch: vi.fn(),
    } as any;
    const { result } = renderHook(() => useInsertTool(adapter, {}));
    expect(result.current.pointer?.onClick).toBeUndefined();
  });

  it('drag.onStart with hitExisting hit selects and does not start the controller', () => {
    const commitInsert = vi.fn();
    const adapter = {
      getSelection: () => [],
      commitInsert,
      commitPaste: vi.fn(() => []),
      snapshotSelection: vi.fn(),
      insertObject: vi.fn(),
      setSelection: vi.fn(),
      applyBatch: vi.fn(),
    } as any;
    const set = vi.fn();
    const { result } = renderHook(() =>
      useInsertTool(adapter, { hitExisting: () => 'hit-1' }),
    );
    const ctx = makeCtx({ selection: { current: [], set } as any });
    let decision: unknown;
    act(() => {
      decision = result.current.drag!.onStart!(pe(), ctx);
      result.current.drag!.onMove!(pe(), ctx);
      result.current.drag!.onEnd!(pe(), ctx);
    });
    expect(decision).toBe('claim');
    expect(set).toHaveBeenCalledWith(['hit-1']);
    expect(commitInsert).not.toHaveBeenCalled();
  });
});

describe('useInsertTool overlay', () => {
  const baseAdapter = {
    getSelection: () => [],
    commitInsert: vi.fn((bounds: any) => ({ id: 'new', ...bounds })),
    commitPaste: vi.fn(() => []),
    snapshotSelection: vi.fn(),
    insertObject: vi.fn(),
    setSelection: vi.fn(),
    applyBatch: vi.fn(),
  } as any;

  it('publishes a RenderLayer on the Tool record', () => {
    const { result } = renderHook(() => useInsertTool(baseAdapter));
    expect(result.current.overlay).toBeDefined();
    expect(result.current.overlay!.space).toBe('screen');
  });

  it('renders nothing when no gesture in flight', () => {
    const { result } = renderHook(() => useInsertTool(baseAdapter));
    const ctx = ctxStub();
    result.current.overlay!.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });

  it('renders the drag rect once the underlying ctl has overlay state', () => {
    const { result } = renderHook(() =>
      useInsertTool(baseAdapter, {
        overlayStyle: { fill: '#abc', stroke: '#def', dash: [2, 2] },
      }),
    );
    act(() => {
      result.current.drag!.onStart!(pe(), makeCtx({ worldX: 10, worldY: 10 }));
      result.current.drag!.onMove!(pe(), makeCtx({ worldX: 50, worldY: 30 }));
    });
    const ctx = ctxStub();
    result.current.overlay!.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
    expect((ctx as any).fillStyle).toBe('#abc');
    expect((ctx as any).strokeStyle).toBe('#def');
  });
});
