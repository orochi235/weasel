import type { ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';

/**
 * Shared `enabled` predicate for selection-gated actions: `true` when the
 * selection is non-empty, otherwise `SelectionRequired`. Called without deps
 * it reports `SelectionRequired`.
 */
export function requiresSelection(deps?: ActionDeps): true | ActionDisabledReason {
  const selection = deps?.selection;
  if (!selection || (selection.get() as unknown[]).length === 0) {
    return ActionDisabledReason.SelectionRequired;
  }
  return true;
}
