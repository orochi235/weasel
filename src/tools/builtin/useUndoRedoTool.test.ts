import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUndoRedoTool } from './useUndoRedoTool';
import type { ToolCtx } from '../types';

function makeCtx(): ToolCtx<undefined> {
  return {
    worldX: 0, worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [] } as any,
    adapter: {},
    applyBatch: vi.fn(),
    scratch: undefined,
  };
}

function keyEvent(key: string, opts: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {}): KeyboardEvent {
  const e = new Event('keydown') as KeyboardEvent;
  Object.assign(e, { key, metaKey: false, ctrlKey: false, shiftKey: false, ...opts });
  return e;
}

describe('useUndoRedoTool', () => {
  const adapter = { undo: vi.fn(() => true), redo: vi.fn(() => true) } as any;

  it('declares id "undoRedo"', () => {
    const { result } = renderHook(() => useUndoRedoTool(adapter));
    expect(result.current.id).toBe('undoRedo');
  });

  it('meta+z calls undo; meta+shift+z calls redo', () => {
    adapter.undo.mockClear(); adapter.redo.mockClear();
    const { result } = renderHook(() => useUndoRedoTool(adapter));
    result.current.keyboard!.onDown!(keyEvent('z', { metaKey: true }), makeCtx());
    expect(adapter.undo).toHaveBeenCalledTimes(1);
    result.current.keyboard!.onDown!(keyEvent('z', { metaKey: true, shiftKey: true }), makeCtx());
    expect(adapter.redo).toHaveBeenCalledTimes(1);
  });

  it('ctrl+z works the same as meta+z (cross-platform)', () => {
    adapter.undo.mockClear();
    const { result } = renderHook(() => useUndoRedoTool(adapter));
    result.current.keyboard!.onDown!(keyEvent('z', { ctrlKey: true }), makeCtx());
    expect(adapter.undo).toHaveBeenCalledTimes(1);
  });

  it('plain z passes', () => {
    const { result } = renderHook(() => useUndoRedoTool(adapter));
    expect(result.current.keyboard!.onDown!(keyEvent('z'), makeCtx())).toBe('pass');
  });
});
