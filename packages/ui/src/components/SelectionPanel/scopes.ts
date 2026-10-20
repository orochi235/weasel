import { asNodeId, sceneSharedUnitScopes, type ScopedScene, type UnitScope } from '@weasel-js/core';
import { prefLeafInScopes } from '@weasel-js/prefs';
import type { AnyNode, PanelSection } from './model';

/** `sections` with every leaf read where `nodes` sit under `root`: the scopes they share. */
export function sectionsInScopes(
  sections: PanelSection[], scene: ScopedScene, nodes: readonly AnyNode[], root: UnitScope | undefined,
): PanelSection[] {
  if (!root || nodes.length === 0) return sections;
  const chain = sceneSharedUnitScopes(scene, nodes.map((n) => asNodeId(n.id)), root);
  return sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => ({
      ...row,
      leaves: row.leaves.map((l) => ({ ...l, leaf: prefLeafInScopes(l.leaf, chain) })),
    })),
  }));
}
