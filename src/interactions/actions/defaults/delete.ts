import { createDeleteOp } from 'core/ops/delete';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import { deriveDefaultBinding } from './_keyBindingFromGesture';

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
 * Static descriptor for the `delete` Action.
 */
export const deleteAction: Action = {
  id: 'delete',
  label: 'Delete',
  gestureBinding: { kind: 'key', key: ['Delete', 'Backspace'] },
  invoker: {
    timing: 'immediate',
    run: (_deps, params) => {
      // The static descriptor's invoker is a no-op stub — getNodeIndex/applyOps
      // deps are only available via the factory; Task 8 wires them through depSchema.
      void params;
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};

/**
 * @experimental
 * Factory for the default `delete` Action. No-op when selection (after
 * `filter`) is empty.
 *
 * @deprecated Phase 4+: use `deleteAction` directly. This wrapper is a
 * Phase 4–7 transition shim and will be removed in Phase 8.
 */
export function defaultDeleteAction(deps: DeleteDeps): Action {
  // Exclude `invoker` so the legacy run path stays active until Task 8.
  const { invoker: _invoker, enabled: _enabled, ...descriptorFields } = deleteAction;
  void _invoker;
  void _enabled;
  return {
    ...descriptorFields,
    defaultBinding: deriveDefaultBinding(deleteAction.gestureBinding),
    run: () => {
      const sel = deps.getSelection();
      const ids = deps.filter ? deps.filter(sel) : sel;
      if (ids.length === 0) return;
      const captured: { obj: { id: string }; index: number }[] = [];
      for (const id of ids) {
        const index = deps.getNodeIndex(id);
        if (index < 0) continue;
        const obj = deps.getNode?.(id) ?? { id };
        captured.push({ obj, index });
      }
      if (captured.length === 0) return;
      // Order by index DESC so reverse-then-invert (history's undo path)
      // re-inserts ASC — each splice lands on a correctly-sized array
      // instead of clamping high indices to a still-growing length.
      captured.sort((a, b) => b.index - a.index);
      const ops: Op[] = captured.map(({ obj, index }) => createDeleteOp({ node: obj, index }));
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
