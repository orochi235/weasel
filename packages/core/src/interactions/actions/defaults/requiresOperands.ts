import type { ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { withoutPageStructure } from 'core/scene/nodeGates';
import type { NodeId } from 'core/scene/types';

/**
 * Shared `enabled` predicate for actions that need something to act on: `true`
 * when the `operands` dep is non-empty, otherwise `SelectionRequired`. Called
 * without deps it reports `SelectionRequired`.
 */
export function requiresSelection(deps?: ActionDeps): true | ActionDisabledReason {
  const operands = deps?.operands;
  if (!operands || operands.get().length === 0) {
    return ActionDisabledReason.SelectionRequired;
  }
  return true;
}

/** The operands less pages and the page run (`withoutPageStructure`): what a scene action acts on. */
export function selectedContent(deps?: ActionDeps): readonly NodeId[] {
  const ids = deps?.operands?.get() ?? [];
  return deps?.scene ? withoutPageStructure(deps.scene, ids) : ids;
}

/** `enabled` for an action needing `min` selected ids that are not page structure ({@link selectedContent}). */
export const requiresContent = (min: number) => (deps?: ActionDeps): true | ActionDisabledReason =>
  selectedContent(deps).length >= min ? true : ActionDisabledReason.SelectionRequired;
