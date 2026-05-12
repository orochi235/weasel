import { useCallback, useEffect, useRef } from 'react';
import { createDeleteOp } from 'core/ops/delete';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import { useKeybinding } from '../useKeybinding';
import { useActionsRegistry, type Action } from '../registry';

/** Adapter for `useDelete`. */
export interface DeleteAdapter {
  /** Read current selection. */
  getSelection(): NodeId[];
  /** Optional: provide the object for a given id; required by `createDeleteOp`
   *  to capture the object for invert/insert. If omitted, a minimal stub
   *  `{ id }` is used — undo will only restore the id, not the full object. */
  getNode?(id: NodeId): { id: string } | undefined | null;
  /** Optional: op-batch entry point. When omitted, ops apply directly. */
  applyOps?(ops: Op[], label: string): void;
  /** Optional: clear selection after delete. If omitted, the hook still
   *  emits a SetSelectionOp([]) alongside DeleteOps. */
  setSelection?(ids: NodeId[]): void;
  /** Optional: removeNode mutator wired by DeleteOp when applyOps is omitted. */
  removeNode?(id: string): void;
}

/** Options for `useDelete`. */
export interface UseDeleteOptions {
  /** Auto-bind Delete and Backspace on document and register a `delete`
   *  action into any surrounding `<ActionsProvider>`. Default true. */
  enableKeyboard?: boolean;
  /** Label passed to applyOps. Default 'Delete'. */
  label?: string;
  /** Optional filter: given selected ids, return the subset to actually delete.
   *  Used by consumers to protect locked or undeletable objects. */
  filter?: (ids: NodeId[]) => NodeId[];
}

/** Return shape of `useDelete`. */
export interface UseDeleteReturn {
  /** Imperative trigger — deletes the current selection. Returns the ids
   *  that were deleted (after filter). Returns [] if nothing was deleted. */
  deleteSelection(): NodeId[];
}

/** Selection-deletion action; binds Delete/Backspace by default. Registers a
 *  `delete` action into a surrounding `<ActionsProvider>` when one is in
 *  scope; otherwise falls back to a document keydown listener. */
export function useDelete(
  adapter: DeleteAdapter,
  options: UseDeleteOptions = {},
): UseDeleteReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const deleteSelection = useCallback((): NodeId[] => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    const ids = o.filter ? o.filter(sel) : sel;
    if (ids.length === 0) return [];
    const ops: Op[] = ids.map((id) => {
      const obj = a.getNode?.(id) ?? { id };
      return createDeleteOp({ node: obj });
    });
    ops.push(createSetSelectionOp({ from: sel, to: [] }));
    dispatchApplyBatch(a, ops, o.label ?? 'Delete');
    return ids;
  }, []);

  const reg = useActionsRegistry();
  const enableKeyboard = options.enableKeyboard ?? true;

  useEffect(() => {
    if (!reg || !enableKeyboard) return;
    const action: Action = {
      id: 'delete',
      label: 'Delete',
      defaultBinding: { key: ['Delete', 'Backspace'] },
      run: () => { deleteSelection(); },
    };
    return reg.register(action);
  }, [reg, enableKeyboard, deleteSelection]);

  useKeybinding(
    { key: ['Delete', 'Backspace'], enabled: enableKeyboard && reg == null },
    () => { deleteSelection(); },
  );

  return { deleteSelection };
}
