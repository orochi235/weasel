import type { ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { withoutPageStructure } from 'core/scene/nodeGates';
import type { NodeId } from 'core/scene/types';

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

/** The selected ids less pages and the page run (`withoutPageStructure`): what a scene action acts on. */
export function selectedContent(deps?: ActionDeps): readonly NodeId[] {
  const ids = (deps?.selection?.get() ?? []) as readonly NodeId[];
  return deps?.scene ? withoutPageStructure(deps.scene, ids) : ids;
}

/** `enabled` for an action needing `min` selected ids that are not page structure ({@link selectedContent}). */
export const requiresContent = (min: number) => (deps?: ActionDeps): true | ActionDisabledReason =>
  selectedContent(deps).length >= min ? true : ActionDisabledReason.SelectionRequired;
