import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AnnotationsApi } from '../annotations/types';
import { editStamp, seedEditStamp } from '../undo/editStamp';
import type { TrialHistorySource } from './trialHistory';
import { useTrialUndo } from './useTrialUndo';

/** A history stamped `stamp` on top, with a redo to drop. */
function side(stamp: number) {
  const listeners = new Set<() => void>();
  let top = stamp;
  return {
    top: (next: number) => {
      top = next;
      for (const l of listeners) l();
    },
    dropRedo: vi.fn(),
    undoStamp: () => top,
    redoStamp: () => undefined,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

describe('useTrialUndo', () => {
  it("keeps both histories' restored redo, and drops the other side's on a new change", () => {
    const restored = Date.now() - 10_000;
    const marks = side(restored);
    const steps = side(restored + 1);
    // As restoring the two histories does.
    seedEditStamp(restored + 1);
    const own = {
      ...steps,
      canUndo: () => true,
      canRedo: () => true,
      undo: () => undefined,
      redo: () => undefined,
      record: () => undefined,
    } as unknown as TrialHistorySource;
    const store = { ...marks, undo: () => true, redo: () => true, redoStamp: () => undefined };
    renderHook(() =>
      useTrialUndo({
        declaresUndo: true,
        marks: { moves: { undo: true, redo: true }, store: store as unknown as AnnotationsApi },
        own,
        snapshots: undefined,
      }),
    );
    expect(marks.dropRedo).not.toHaveBeenCalled();
    expect(steps.dropRedo).not.toHaveBeenCalled();

    act(() => steps.top(editStamp()));
    expect(marks.dropRedo).toHaveBeenCalledTimes(1);
    expect(steps.dropRedo).not.toHaveBeenCalled();
  });
});
