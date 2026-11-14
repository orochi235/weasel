import { asNodeId, sceneSharedUnitScopes, type ScopedScene, type UnitScope } from '@weasel-js/core';
import { prefLeafInScopes } from '@weasel-js/prefs';
import { isPanelSection, type AnyNode, type PanelItem, type PanelSection } from './model';

/** `sections` with every leaf read where `nodes` sit under `root`: the scopes they share. */
export function sectionsInScopes(
  sections: PanelSection[], scene: ScopedScene, nodes: readonly AnyNode[], root: UnitScope | undefined,
): PanelSection[] {
  if (!root || nodes.length === 0) return sections;
  const chain = sceneSharedUnitScopes(scene, nodes.map((n) => asNodeId(n.id)), root);
  const within = (item: PanelItem): PanelItem =>
    isPanelSection(item)
      ? { ...item, items: item.items.map(within) }
      : { ...item, leaves: item.leaves.map((l) => ({ ...l, leaf: prefLeafInScopes(l.leaf, chain) })) };
  return sections.map((section) => within(section) as PanelSection);
}
