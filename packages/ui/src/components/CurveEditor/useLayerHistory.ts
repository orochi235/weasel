import { useCallback, useState } from 'react';
import { useLatest } from '@weasel-js/react';
import { createHistory, type Op } from '@weasel-js/history';
import type { LayerEntry } from './layerHost';

/** Undo steps the built-in history keeps. */
export const HISTORY_DEPTH = 100;

/** Every layer's state, by layer. */
export type LayerSnapshot = Map<LayerEntry, unknown>;

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
export function useLayerHistory(layers: () => readonly LayerEntry[]) {
  const [history] = useState(() => createHistory(null, { historyLimit: HISTORY_DEPTH }));

  const snapshot = useCallback((): LayerSnapshot => {
    const m: LayerSnapshot = new Map();
    for (const entry of layers()) m.set(entry, entry.state);
    return m;
  }, [layers]);

  const restore = useLatest((snap: LayerSnapshot) => {
    for (const entry of layers()) {
      const prev = snap.get(entry);
      const current = entry.state;
      if (prev !== undefined && prev !== current) {
        entry.onChange(prev);
        entry.onCommit?.(prev, current);
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
