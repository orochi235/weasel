import { useCallback, useState } from 'react';
import { useLatest } from '@weasel-js/react';
import { createHistory, type Op } from '@weasel-js/history';

/** Undo steps the built-in history keeps. */
export const HISTORY_DEPTH = 100;

/** Every layer's state, by layer id. */
export type LayerSnapshot = Map<string, unknown>;

interface Bound { layer: { id: string }; state: unknown }

/**
 * One edit, as a return to the layer states it started from. The state it
 * leaves is read when it is undone, not when it is recorded: the editor is
 * controlled, so its props still hold the old states when it records.
 */
function editOp(before: LayerSnapshot, read: () => LayerSnapshot, restore: (snap: LayerSnapshot) => void): Op {
  let after: LayerSnapshot | null = null;
  const forward: Op = {
    label: 'edit',
    apply: () => { if (after) restore(after); },
    invert: () => {
      after = read();
      return { label: 'edit', apply: () => restore(before), invert: () => forward };
    },
  };
  return forward;
}

/**
 * The layered editor's built-in undo, on a `@weasel-js/history` stack. A step
 * restores each layer whose state differs, reported the way a finished edit is.
 */
export function useLayerHistory(
  layersRef: { readonly current: ReadonlyArray<Bound> },
  onLayerChange: (id: string, next: unknown) => void,
  onLayerCommit: ((id: string, next: unknown, prev: unknown) => void) | undefined,
) {
  const [history] = useState(() => createHistory(null, { historyLimit: HISTORY_DEPTH }));

  const snapshot = useCallback((): LayerSnapshot => {
    const m: LayerSnapshot = new Map();
    for (const b of layersRef.current) m.set(b.layer.id, b.state);
    return m;
  }, [layersRef]);

  const restore = useLatest((snap: LayerSnapshot) => {
    for (const b of layersRef.current) {
      const prev = snap.get(b.layer.id);
      if (prev !== undefined && prev !== b.state) {
        onLayerChange(b.layer.id, prev);
        onLayerCommit?.(b.layer.id, prev, b.state);
      }
    }
  });

  /** Record an edit that started from `before` and has already been reported. */
  const record = useCallback((before: LayerSnapshot) => {
    history.recordEntry([editOp(before, snapshot, (snap) => restore.current(snap))], 'edit');
  }, [history, snapshot, restore]);

  const undo = useCallback(() => history.undo(), [history]);
  const redo = useCallback(() => history.redo(), [history]);

  return { snapshot, record, undo, redo };
}
