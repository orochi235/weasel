import type { SelectionApi } from 'core/selection/useSelection';
import type { ActionDeps } from '../invoker';
import { ActionDisabledReason } from '../registry';

/**
 * Shared `enabled` predicate for selection-gated actions (reorder, duplicate,
 * flip, nudge, …).
 *
 * Returns `true` when the active selection is non-empty, otherwise
 * `SelectionRequired` so the palette/ActionBar can grey the entry out.
 *
 * The dispatcher evaluates this gate with the action's built deps, so a
 * deps-aware predicate is required for these actions to dispatch at all — a
 * constant `() => SelectionRequired` stub falls through forever. When called
 * without deps (e.g. a bare `enabled()` introspection) it conservatively
 * reports `SelectionRequired`; the invoker independently no-ops on an empty
 * selection, so dispatch correctness never relies on the gate alone.
 */
export function requiresSelection(deps?: ActionDeps): true | ActionDisabledReason {
  const selection = deps?.selection as SelectionApi | undefined;
  if (!selection || (selection.get() as unknown[]).length === 0) {
    return ActionDisabledReason.SelectionRequired;
  }
  return true;
}
