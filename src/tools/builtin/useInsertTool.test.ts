import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInsertTool } from './useInsertTool';
import type { ToolCtx } from '../types';

function makeCtx(over: Partial<ToolCtx<undefined>> = {}): ToolCtx<undefined> {
  return {
    worldX: 10,
    worldY: 20,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [] } as any,
    adapter: {},
    applyBatch: vi.fn(),
    scratch: undefined,
    ...over,
  };
}

function pe(): PointerEvent {
  const e = new Event('pointerdown') as PointerEvent;
  Object.assign(e, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
  return e;
}

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

  it('drag.onEnd returns "claim"', () => {
    const { result } = renderHook(() => useInsertTool(baseAdapter, opts));
    result.current.drag!.onStart!(pe(), makeCtx({ worldX: 0, worldY: 0 }));
    result.current.drag!.onMove!(pe(), makeCtx({ worldX: 50, worldY: 50 }));
    const decision = result.current.drag!.onEnd!(pe(), makeCtx({ worldX: 50, worldY: 50 }));
    expect(decision).toBe('claim');
  });
});
