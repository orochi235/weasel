/**
 * `clearSelectionAction` — immediate Action descriptor for click-on-empty
 * selection clearing (Phase 14a).
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
 * ## enabled
 *
 * Returns `SelectionRequired` disabled reason when nothing is selected, so the
 * dispatcher skips the action on an already-empty canvas (no-op guard).
 */

import type { Action } from '../registry';
import type { NodeId } from 'core/scene/types';

/**
 * @experimental
 * Static descriptor for the `clearSelection` Action.
 *
 * Requires dep-schema entry: `selection`.
 *
 * Registered via `useStandardActions`; bound via `useSelectTool.bindings`.
 */
export const clearSelectionAction: Action & { requires: string[] } = {
  id: 'clearSelection',
  label: 'Clear selection',
  // No defaultBinding / defaultBinding — fires only via Tool.bindings.
  eligible: { capability: 'creates-selection' },
  requires: ['selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      (deps.selection as { set(ids: NodeId[]): void } | undefined)?.set([]);
    },
  },
  // No `enabled` guard: the action always runs when matched. The binding spec
  // (`{ kind: 'click', target: 'empty', mods: {} }`) is the real gate —
  // it only fires from useSelectTool when the pointer lands on empty canvas.
  // A per-invocation "is there a selection to clear?" guard in invoker.run
  // is unnecessary: clearing an already-empty selection is a safe no-op.
};
