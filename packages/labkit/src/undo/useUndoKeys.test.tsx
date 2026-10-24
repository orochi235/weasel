import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type UndoKeysTarget, useUndoKeys } from './useUndoKeys';

function target(can = { undo: true, redo: true }): UndoKeysTarget & {
  undo: ReturnType<typeof vi.fn>;
  redo: ReturnType<typeof vi.fn>;
} {
  return {
    canUndo: () => can.undo,
    canRedo: () => can.redo,
    undo: vi.fn(),
    redo: vi.fn(),
  };
}

function input(type: string): HTMLInputElement {
  const el = document.createElement('input');
  el.type = type;
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('useUndoKeys', () => {
  it('undoes on Mod+Z and redoes on Shift+Mod+Z and Mod+Y, claiming the chord', () => {
    const t = target();
    renderHook(() => useUndoKeys(t));
    expect(fireEvent.keyDown(document.body, { key: 'z', metaKey: true })).toBe(false);
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true });
    expect(t.undo).toHaveBeenCalledTimes(1);
    expect(t.redo).toHaveBeenCalledTimes(2);
  });

  it('leaves the chord to a text field, but not to a slider', () => {
    const t = target();
    renderHook(() => useUndoKeys(t));
    expect(fireEvent.keyDown(input('text'), { key: 'z', metaKey: true })).toBe(true);
    fireEvent.keyDown(input('range'), { key: 'z', metaKey: true });
    expect(t.undo).toHaveBeenCalledTimes(1);
  });

  it('leaves a chord with nothing to step to the browser', () => {
    const t = target({ undo: false, redo: true });
    renderHook(() => useUndoKeys(t));
    expect(fireEvent.keyDown(document.body, { key: 'z', metaKey: true })).toBe(true);
    expect(t.undo).not.toHaveBeenCalled();
  });

  it('binds nothing for null, and unbinds on unmount', () => {
    const t = target();
    const { rerender, unmount } = renderHook(({ h }) => useUndoKeys(h), {
      initialProps: { h: null as UndoKeysTarget | null },
    });
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true });
    rerender({ h: t });
    unmount();
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true });
    expect(t.undo).not.toHaveBeenCalled();
  });
});
