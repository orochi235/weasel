import { createInsertOp } from 'core/ops/create';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/** @experimental */
export interface DuplicateDeps {
  getSelection: () => NodeId[];
  cloneNode: (id: NodeId, offset: { dx: number; dy: number }) => { id: NodeId };
  applyOps: (ops: Op[], label?: string) => void;
  /** Per-clone translation. Default {dx:8, dy:8}. */
  offset?: { dx: number; dy: number };
}

const DEFAULT_OFFSET = { dx: 8, dy: 8 };

/**
 * @experimental
 * Static descriptor for the `duplicate` Action. Duplicates selection.
 */
export const duplicateAction: Action = {
  id: 'duplicate',
  label: 'Duplicate',
  gestureBinding: { kind: 'key', key: 'd', mods: { mod: true } },
  invoker: {
    timing: 'immediate',
    run: (_deps, params) => {
      // The static descriptor's invoker is a no-op without the typed deps bag
      // (cloneNode, applyOps) that only the factory bridge can supply.
      // Task 8 wires this properly via useStandardActions.
      void params;
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};

/**
 * @experimental
 * Factory for the default `duplicate` Action. Run is a no-op when selection
 * is empty.
 *
 * @deprecated Phase 4+: use `duplicateAction` directly. This wrapper is a
 * Phase 4–7 transition shim and will be removed in Phase 8.
 */
export function defaultDuplicateAction(deps: DuplicateDeps): Action {
  const offset = deps.offset ?? DEFAULT_OFFSET;
  // Exclude `invoker` so the legacy run path stays active until Task 8.
  const { invoker: _invoker, enabled: _enabled, ...descriptorFields } = duplicateAction;
  void _invoker;
  void _enabled;
  return {
    ...descriptorFields,
    run: () => {
      const sel = deps.getSelection();
      if (sel.length === 0) return;
      const created = sel.map((id) => deps.cloneNode(id, offset));
      if (created.length === 0) return;
      const ops: Op[] = [
        ...created.map((obj) => createInsertOp({ node: obj })),
        createSetSelectionOp({ from: sel, to: created.map((c) => c.id) }),
      ];
      deps.applyOps(ops, 'Duplicate');
    },
    enabled: () => (deps.getSelection().length > 0 ? true : ActionDisabledReason.SelectionRequired),
  };
}
