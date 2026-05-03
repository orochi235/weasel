import { useCallback, useRef } from 'react';
import { createDeleteOp } from '../../../core/ops/delete';
import { createSetSelectionOp } from '../../../core/ops/selection';
import type { Op } from '../../../core/ops/types';
import { dispatchApplyBatch } from '../../../core/ops/applyOpsTo';
import { useKeybinding } from '../useKeybinding';

/** Adapter for `useDelete`. */
export interface DeleteAdapter {
  /** Read current selection. */
  getSelection(): string[];
  /** Optional: provide the object for a given id; required by `createDeleteOp`
   *  to capture the object for invert/insert. If omitted, a minimal stub
   *  `{ id }` is used — undo will only restore the id, not the full object. */
  getObject?(id: string): { id: string } | undefined | null;
  /** Optional: op-batch entry point. When omitted, ops apply directly. */
  applyBatch?(ops: Op[], label: string): void;
  /** Optional: clear selection after delete. If omitted, the hook still
   *  emits a SetSelectionOp([]) alongside DeleteOps. */
  setSelection?(ids: string[]): void;
  /** Optional: removeObject mutator wired by DeleteOp when applyBatch is omitted. */
  removeObject?(id: string): void;
}

/** Options for `useDelete`. */
export interface UseDeleteOptions {
  /** Auto-bind Delete and Backspace keys on document. Default false. */
  bindKeyboard?: boolean;
  /** Label passed to applyBatch. Default 'Delete'. */
  label?: string;
  /** Optional filter: given selected ids, return the subset to actually delete.
   *  Used by consumers to protect locked or undeletable objects. */
  filter?: (ids: string[]) => string[];
}

/** Return shape of `useDelete`. */
export interface UseDeleteReturn {
  /** Imperative trigger — deletes the current selection. Returns the ids
   *  that were deleted (after filter). Returns [] if nothing was deleted. */
  deleteSelection(): string[];
}

/** Selection-deletion action; optionally binds Delete/Backspace keys. */
export function useDelete(
  adapter: DeleteAdapter,
  options: UseDeleteOptions = {},
): UseDeleteReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const deleteSelection = useCallback((): string[] => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    const ids = o.filter ? o.filter(sel) : sel;
    if (ids.length === 0) return [];
    const ops: Op[] = ids.map((id) => {
      const obj = a.getObject?.(id) ?? { id };
      return createDeleteOp({ object: obj });
    });
    ops.push(createSetSelectionOp({ from: sel, to: [] }));
    dispatchApplyBatch(a, ops, o.label ?? 'Delete');
    return ids;
  }, []);

  useKeybinding(
    { key: ['Delete', 'Backspace'], enabled: !!options.bindKeyboard },
    () => { deleteSelection(); },
  );

  return { deleteSelection };
}
