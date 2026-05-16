import { createDeleteOp } from 'core/ops/delete';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/** @experimental */
export interface DeleteDeps {
  getSelection: () => NodeId[];
  /** Optional: capture the full object so the inverse `InsertOp` can restore
   *  the original payload on undo. If omitted, a stub `{ id }` is used. */
  getNode?: (id: NodeId) => { id: string } | undefined | null;
  /** Original z-index of `id` in the host array. Threaded through the
   *  inverted Insert so undo of a multi-delete batch restores paint
   *  order. Return `-1` if the id isn't found. */
  getNodeIndex: (id: NodeId) => number;
  applyOps: (ops: Op[], label?: string) => void;
  /** Optional: subset of selection that should actually delete. Used to
   *  protect locked items. */
  filter?: (ids: NodeId[]) => NodeId[];
}

/**
 * @experimental
 * Factory for the default `delete` Action. No-op when selection (after
 * `filter`) is empty.
 */
export function defaultDeleteAction(deps: DeleteDeps): Action {
  return {
    id: 'delete',
    label: 'Delete',
    defaultBinding: { key: ['Delete', 'Backspace'] },
    run: () => {
      const sel = deps.getSelection();
      const ids = deps.filter ? deps.filter(sel) : sel;
      if (ids.length === 0) return;
      const ops: Op[] = [];
      for (const id of ids) {
        const index = deps.getNodeIndex(id);
        if (index < 0) continue;
        const obj = deps.getNode?.(id) ?? { id };
        ops.push(createDeleteOp({ node: obj, index }));
      }
      if (ops.length === 0) return;
      ops.push(createSetSelectionOp({ from: sel, to: [] }));
      deps.applyOps(ops, 'Delete');
    },
    enabled: () => {
      const sel = deps.getSelection();
      const ids = deps.filter ? deps.filter(sel) : sel;
      return ids.length > 0 ? true : ActionDisabledReason.SelectionRequired;
    },
  };
}
