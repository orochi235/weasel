import type { UnitScope } from '@weasel-js/quantity';
import { asNodeId, sceneSharedUnitScopes, type ScopedScene } from '@weasel-js/core';
import { prefLeafInUnitScopes } from '@weasel-js/prefs';
import { isPanelSection, type PanelItem, type PanelSection } from '@weasel-js/ui/components/PanelCells';
import type { AnyNode } from './nodeModel';

/** `sections` with every leaf read where `nodes` sit under `root`: the scopes they share. */
export function sectionsInScopes(
  sections: PanelSection[], scene: ScopedScene, nodes: readonly AnyNode[], root: UnitScope | undefined,
): PanelSection[] {
  if (!root || nodes.length === 0) return sections;
  const chain = sceneSharedUnitScopes(scene, nodes.map((n) => asNodeId(n.id)), root);
  const within = (item: PanelItem): PanelItem =>
    isPanelSection(item)
      ? { ...item, items: item.items.map(within) }
      : { ...item, leaves: item.leaves.map((l) => ({ ...l, leaf: prefLeafInUnitScopes(l.leaf, chain) })) };
  return sections.map((section) => within(section) as PanelSection);
}
