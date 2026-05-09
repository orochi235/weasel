import { createInsertOp } from '../../../core/ops/create';
import { createSetSelectionOp } from '../../../core/ops/select';
import type { Op } from '../../../core/ops/types';
import type { NodeId } from '../../../core/scene/types';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/** @experimental */
export interface DuplicateDeps {
  getSelection: () => NodeId[];
  cloneObject: (id: NodeId, offset: { dx: number; dy: number }) => { id: NodeId };
  applyBatch: (ops: Op[], label?: string) => void;
  /** Per-clone translation. Default {dx:8, dy:8}. */
  offset?: { dx: number; dy: number };
}

/**
 * @experimental
 * Factory for the default `duplicate` Action. Run is a no-op when selection
 * is empty.
 */
export function defaultDuplicateAction(deps: DuplicateDeps): Action {
  const offset = deps.offset ?? { dx: 8, dy: 8 };
  return {
    id: 'duplicate',
    label: 'Duplicate',
    defaultBinding: { key: 'd', mod: true },
    run: () => {
      const sel = deps.getSelection();
      if (sel.length === 0) return;
      const created = sel.map((id) => deps.cloneObject(id, offset));
      if (created.length === 0) return;
      const ops: Op[] = [
        ...created.map((obj) => createInsertOp({ object: obj })),
        createSetSelectionOp({ from: sel, to: created.map((c) => c.id) }),
      ];
      deps.applyBatch(ops, 'Duplicate');
    },
    enabled: () => (deps.getSelection().length > 0 ? true : ActionDisabledReason.SelectionRequired),
  };
}
