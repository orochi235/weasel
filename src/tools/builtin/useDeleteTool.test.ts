import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeleteTool } from './useDeleteTool';
import type { ToolCtx } from '../types';

function makeCtx(): ToolCtx<undefined> {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: ['a'], applyClick: () => {}, set: () => {}, clear: () => {} } as any,
    adapter: {},
    applyBatch: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: undefined,
  };
}

function keyEvent(key: string): KeyboardEvent {
  const e = new Event('keydown') as KeyboardEvent;
  Object.assign(e, { key });
  return e;
}

describe('useDeleteTool', () => {
  it('returns a Tool with id "delete" and keybinding "Backspace"', () => {
    const adapter = { getSelection: () => ['a'], getNode: () => ({ id: 'a' }), applyBatch: vi.fn() } as any;
    const { result } = renderHook(() => useDeleteTool(adapter));
    expect(result.current.id).toBe('delete');
    expect(result.current.keybinding).toBe('Backspace');
    expect(result.current.keyboard?.onDown).toBeDefined();
  });

  it('claims Backspace and Delete; passes other keys', () => {
    const adapter = {
      getSelection: () => ['a'],
      getNode: () => ({ id: 'a' }),
      applyBatch: vi.fn(), // intercept ops so we don't need full adapter surface
    } as any;
    const { result } = renderHook(() => useDeleteTool(adapter));
    expect(result.current.keyboard!.onDown!(keyEvent('Backspace'), makeCtx())).toBe('claim');
    expect(result.current.keyboard!.onDown!(keyEvent('Delete'), makeCtx())).toBe('claim');
    expect(result.current.keyboard!.onDown!(keyEvent('a'), makeCtx())).toBe('pass');
  });

  it('invokes adapter delete when Backspace is pressed with selection', () => {
    // useDelete dispatches through adapter.applyBatch when present
    const applyBatch = vi.fn();
    const adapter = {
      getSelection: () => ['a', 'b'],
      getNode: (id: string) => ({ id }),
      applyBatch,
    } as any;
    const { result } = renderHook(() => useDeleteTool(adapter));
    act(() => {
      result.current.keyboard!.onDown!(keyEvent('Backspace'), makeCtx());
    });
    expect(applyBatch).toHaveBeenCalledTimes(1);
    const ops = applyBatch.mock.calls[0][0];
    expect(ops.length).toBeGreaterThan(0);
  });

  it('does nothing on empty selection', () => {
    const applyBatch = vi.fn();
    const adapter = {
      getSelection: () => [],
      getNode: () => null,
      applyBatch,
    } as any;
    const { result } = renderHook(() => useDeleteTool(adapter));
    result.current.keyboard!.onDown!(keyEvent('Backspace'), makeCtx());
    expect(applyBatch).not.toHaveBeenCalled();
  });
});
