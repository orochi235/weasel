import { useCallback, useRef } from 'react';
import { createInsertOp } from '../../core/ops/create';
import { createSetSelectionOp } from '../../core/ops/selection';
import type { Op } from '../../core/ops/types';
import { dispatchApplyBatch } from '../../core/ops/applyOpsTo';
import type { InsertAdapter } from '../../core/adapters/types';
import type { ClipboardSnapshot } from './types';

/** Options for `useClipboardOps`. */
export interface UseClipboardOpsOptions {
  /** How the hook reads "current selection" for copy. The kit doesn't assume
   *  a global selection store; each consumer wires this. */
  getSelection: () => string[];
  /** Called after a successful paste with the ids of the newly inserted objects. */
  onPaste?: (newIds: string[]) => void;
  /** Label for the history entry produced by paste. Default 'Paste'. */
  pasteLabel?: string;
}

/** Return shape of `useClipboardOps`: imperative `copy`, `paste`, and `isEmpty` functions. */
export interface UseClipboardOpsReturn {
  copy(): void;
  paste(): void;
  isEmpty(): boolean;
}

const EMPTY: ClipboardSnapshot = { items: [] };

/** In-memory copy/paste of selections via `InsertAdapter.snapshotSelection` / `commitPaste`. */
export function useClipboardOps<TObject extends { id: string }>(
  adapter: InsertAdapter<TObject>,
  options: UseClipboardOpsOptions,
): UseClipboardOpsReturn {
  const { getSelection, onPaste, pasteLabel = 'Paste' } = options;
  const clipboardRef = useRef<ClipboardSnapshot>(EMPTY);
  // Keep callbacks stable across renders.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef({ getSelection, onPaste, pasteLabel });
  optsRef.current = { getSelection, onPaste, pasteLabel };

  const copy = useCallback(() => {
    const ids = optsRef.current.getSelection();
    if (ids.length === 0) return;
    clipboardRef.current = adapterRef.current.snapshotSelection(ids);
  }, []);

  const paste = useCallback(() => {
    const cb = clipboardRef.current;
    if (cb.items.length === 0) return;
    const a = adapterRef.current;
    const offset = a.getPasteOffset?.(cb) ?? { dx: 0, dy: 0 };
    const created = a.commitPaste(cb, offset);
    if (created.length === 0) return;
    const newIds = created.map((o) => o.id);
    const beforeSel = optsRef.current.getSelection();
    const ops: Op[] = [
      ...created.map((o) => createInsertOp({ object: o })),
      createSetSelectionOp({ from: beforeSel, to: newIds }),
    ];
    dispatchApplyBatch(a, ops, optsRef.current.pasteLabel);
    // Cascade: next paste shifts again by `offset` from these copies.
    clipboardRef.current = a.snapshotSelection(newIds);
    optsRef.current.onPaste?.(newIds);
  }, []);

  const isEmpty = useCallback(() => clipboardRef.current.items.length === 0, []);

  return { copy, paste, isEmpty };
}
