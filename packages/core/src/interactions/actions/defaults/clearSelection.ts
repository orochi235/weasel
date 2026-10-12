import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { ActionDeps } from '@weasel-js/routing';

/**
 * @experimental
 * Clears the selection on a click on empty canvas. It has no ambient
 * `defaultBinding`: it fires only through `useSelectTool`'s bindings.
 *
 * `enabled` declines while a path is in anchor-edit mode, so the dispatcher
 * falls through to `selectAnchorAction`. `useSelectTool` binds this action at
 * **active** scope while `selectAnchor` is **ambient**, so without the gate an
 * anchor that sits over empty canvas clears the node selection instead of
 * selecting the anchor. Capability eligibility covers only consumers that
 * wired a mode registry.
 */
export const clearSelectionAction: Action & { requires: string[] } = {
  id: 'clearSelection',
  label: 'Clear selection',
  eligible: { capability: 'creates-selection' },
  // `editAnchors` is required for the `enabled` gate below, not for the run.
  requires: ['selection', 'editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      deps.selection?.set([]);
    },
  },
  enabled: (deps?: ActionDeps) => {
    const editAnchors = deps?.editAnchors;
    // Absent dep means the consumer never wired anchor editing — nothing to
    // defer to, so the click is ours.
    if (editAnchors?.editingId) return ActionDisabledReason.NotApplicable;
    return true;
  },
};
