/**
 * `clearSelectionAction` — immediate Action descriptor for click-on-empty
 * selection clearing.
 *
 * ## Status: REAL
 *
 * Fires via `useSelectTool.bindings` when the user clicks on empty canvas
 * with no modifier held. Clears the selection by calling `deps.selection.set([])`.
 *
 * ## No defaultBinding
 *
 * This action has no ambient `defaultBinding` / `defaultBinding` — it fires
 * ONLY via `useSelectTool`'s `Tool.bindings` entry:
 *   `{ spec: { kind: 'click', target: 'empty', mods: {} }, actionId: 'clearSelection' }`
 *
 * This avoids ambient double-fire and keeps the action scoped to select-tool
 * context where `classifyTarget` is wired.
 *
 * ## enabled — the anchor-editing fall-through
 *
 * There is no "is anything selected?" guard: clearing an already-empty
 * selection is a safe no-op, and the binding spec is the real gate for
 * where the click landed.
 *
 * What `enabled` *does* do is decline while a path is in anchor-edit mode,
 * so the dispatcher falls through to `selectAnchorAction`. This is the
 * click twin of the opt-out `areaSelectAction.start` already performs for
 * the drag gesture, and it exists for the same reason: `useSelectTool`
 * binds this action at **active** scope while `selectAnchor` is **ambient**,
 * so without the gate an anchor that happens to sit over empty canvas
 * clears the node selection instead of selecting the anchor.
 *
 * Capability eligibility (`creates-selection`, which `path-edit` does not
 * allow) already covers consumers that wired a mode registry. Consumers
 * without one get no eligibility filtering at all, so this gate is the only
 * thing separating the two. Both mechanisms are needed — see the header of
 * `anchorEditing.ts`.
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { ActionDeps } from '../invoker';
import type { EditAnchorsDep } from '../depSchema';
import type { NodeId } from 'core/scene/types';

/**
 * @experimental
 * Static descriptor for the `clearSelection` Action.
 *
 * Requires dep-schema entries: `selection`, `editAnchors`.
 *
 * Registered via `useStandardActions`; bound via `useSelectTool.bindings`.
 */
export const clearSelectionAction: Action & { requires: string[] } = {
  id: 'clearSelection',
  label: 'Clear selection',
  // No defaultBinding / defaultBinding — fires only via Tool.bindings.
  eligible: { capability: 'creates-selection' },
  // `editAnchors` is required for the `enabled` gate below, not for the run.
  requires: ['selection', 'editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      (deps.selection as { set(ids: NodeId[]): void } | undefined)?.set([]);
    },
  },
  enabled: (deps?: ActionDeps) => {
    const editAnchors = deps?.editAnchors as EditAnchorsDep | undefined;
    // Absent dep means the consumer never wired anchor editing — nothing to
    // defer to, so the click is ours.
    if (editAnchors?.editingId) return ActionDisabledReason.NotApplicable;
    return true;
  },
};
