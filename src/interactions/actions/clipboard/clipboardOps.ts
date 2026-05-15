import { useCallback, useRef } from 'react';
import { createInsertOp } from 'core/ops/create';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { InsertAdapter } from 'core/adapters/types';
import type { ClipboardSnapshot } from './types';

/** Options for `useClipboardOps`. */
export interface UseClipboardOpsOptions {
  /** How the hook reads "current selection" for copy. The kit doesn't assume
   *  a global selection store; each consumer wires this. */
  getSelection: () => NodeId[];
  /** Called after a successful paste with the ids of the newly inserted objects. */
  onPaste?: (newIds: NodeId[]) => void;
  /** Label for the history entry produced by paste. Default 'Paste'. */
  pasteLabel?: string;
  /** Pulled once per paste() call. When non-null, threaded to commitPaste
   *  as `ctx.dropPoint`; adapters typically use it as the cluster origin
   *  (ignoring `offset`). When null/undefined, the hook falls back to the
   *  existing cascade-offset behavior. */
  getDropPoint?: () => { worldX: number; worldY: number } | null;
}

/** Return shape of `useClipboardOps`: imperative `copy`, `paste`, and `isEmpty` functions. */
export interface UseClipboardOpsReturn {
  copy(): void;
  paste(): void;
  isEmpty(): boolean;
}

const EMPTY: ClipboardSnapshot = { items: [] };

/** In-memory copy/paste of selections via `InsertAdapter.snapshotSelection` / `commitPaste`. */
export function useClipboardOps<TNode extends { id: string }>(
  adapter: InsertAdapter<TNode>,
  options: UseClipboardOpsOptions,
): UseClipboardOpsReturn {
  const { getSelection, onPaste, pasteLabel = 'Paste', getDropPoint } = options;
  const clipboardRef = useRef<ClipboardSnapshot>(EMPTY);
  // Keep callbacks stable across renders.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef({ getSelection, onPaste, pasteLabel, getDropPoint });
  optsRef.current = { getSelection, onPaste, pasteLabel, getDropPoint };

  const copy = useCallback(() => {
    const ids = optsRef.current.getSelection();
    if (ids.length === 0) return;
    const snap = adapterRef.current.snapshotSelection;
    if (!snap) return;
    clipboardRef.current = snap(ids);
  }, []);

  const paste = useCallback(() => {
    const cb = clipboardRef.current;
    if (cb.items.length === 0) return;
    const a = adapterRef.current;
    if (!a.commitPaste) return;
    const offset = a.getPasteOffset?.(cb) ?? { dx: 0, dy: 0 };
    const dropPoint = optsRef.current.getDropPoint?.();
    const ctx = dropPoint != null ? { dropPoint } : undefined;
    const created = a.commitPaste(cb, offset, ctx);
    if (created.length === 0) return;
    const newIds = created.map((o) => o.id as NodeId);
    const beforeSel = optsRef.current.getSelection();
    const ops: Op[] = [
      ...created.map((o) => createInsertOp({ node: o })),
      createSetSelectionOp({ from: beforeSel, to: newIds }),
    ];
    dispatchApplyBatch(a, ops, optsRef.current.pasteLabel);
    // Use the just-created objects as the next cascade source. Re-snapshotting
    // via `adapter.snapshotSelection(newIds)` would read adapter state, but
    // React-state adapters haven't flushed yet — `itemsRef.current` still
    // points at the pre-insert array, so the snapshot would come back empty
    // and the next paste would no-op.
    clipboardRef.current = { items: created };
    optsRef.current.onPaste?.(newIds);
  }, []);

  const isEmpty = useCallback(() => clipboardRef.current.items.length === 0, []);

  return { copy, paste, isEmpty };
}
