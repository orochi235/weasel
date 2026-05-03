import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from './undoRedo';

function makeAdapter(opts: { canUndo?: boolean; canRedo?: boolean } = {}) {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: opts.canUndo === undefined ? undefined : vi.fn(() => !!opts.canUndo),
    canRedo: opts.canRedo === undefined ? undefined : vi.fn(() => !!opts.canRedo),
  };
}

describe('useUndoRedo', () => {
  it('undo() and redo() forward to the adapter when no can* gates exist', () => {
    const a = makeAdapter();
    const { result } = renderHook(() => useUndoRedo(a));
    let r1 = false;
    let r2 = false;
    act(() => { r1 = result.current.undo(); });
    act(() => { r2 = result.current.redo(); });
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(a.undo).toHaveBeenCalledTimes(1);
    expect(a.redo).toHaveBeenCalledTimes(1);
  });

  it('respects canUndo/canRedo gates', () => {
    const a = makeAdapter({ canUndo: false, canRedo: false });
    const { result } = renderHook(() => useUndoRedo(a));
    let r1 = true;
    let r2 = true;
    act(() => { r1 = result.current.undo(); });
    act(() => { r2 = result.current.redo(); });
    expect(r1).toBe(false);
    expect(r2).toBe(false);
    expect(a.undo).not.toHaveBeenCalled();
    expect(a.redo).not.toHaveBeenCalled();
  });

  describe('keyboard', () => {
    it('Mod+Z fires undo when bindKeyboard is true', () => {
      const a = makeAdapter();
      renderHook(() => useUndoRedo(a, { bindKeyboard: true }));
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }),
        );
      });
      expect(a.undo).toHaveBeenCalledTimes(1);
      expect(a.redo).not.toHaveBeenCalled();
    });

    it('Mod+Shift+Z fires redo when bindKeyboard is true', () => {
      const a = makeAdapter();
      renderHook(() => useUndoRedo(a, { bindKeyboard: true }));
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'z',
            metaKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      expect(a.redo).toHaveBeenCalledTimes(1);
      expect(a.undo).not.toHaveBeenCalled();
    });

    it('does not bind keys by default', () => {
      const a = makeAdapter();
      renderHook(() => useUndoRedo(a));
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }),
        );
      });
      expect(a.undo).not.toHaveBeenCalled();
    });
  });
});
