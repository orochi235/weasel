/**
 * Loads a scene saved before the diagram trait's `group` became `cluster`: a
 * `NodeUpgrade` `withDiagramRegistry` registers, so `sceneFromJSON` and
 * `loadState` rewrite the old names before anything reads them.
 */
import type { NodeUpgrade } from '@weasel-js/core';
import { DIAGRAM_CLUSTER } from './clusterBox';
import { DIAGRAM_TRAIT_KEY } from './trait';

/** The registry key {@link upgradeClusterNames} is registered under. */
export const DIAGRAM_CLUSTER_UPGRADE = 'diagram:cluster-names';

const OLD_KEY = 'diagram:group';

/** A saved node with its diagram trait's `group` as `cluster`, and the derive key
 *  `'diagram:group'` as {@link DIAGRAM_CLUSTER}. Any other node is returned as it is. */
export const upgradeClusterNames: NodeUpgrade = (node) => {
  let out = node;
  const data = node.data;
  const trait = data !== null && typeof data === 'object' ? (data as Record<string, unknown>)[DIAGRAM_TRAIT_KEY] : undefined;
  if (trait !== null && typeof trait === 'object' && Object.hasOwn(trait, 'group')) {
    const { group, ...rest } = trait as Record<string, unknown>;
    out = { ...out, data: { ...(data as Record<string, unknown>), [DIAGRAM_TRAIT_KEY]: { ...rest, cluster: group } } };
  }
  if (out.derivePoseKey === OLD_KEY) out = { ...out, derivePoseKey: DIAGRAM_CLUSTER };
  return out;
};
