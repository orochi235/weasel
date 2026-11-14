import { flatten, pairNodes, type OriginOf } from './schemaExport';
import type { SchemaNode } from './schemaEdit';
import { assetOf, type Workspace } from './workspace';

/**
 * Where each node an editor has shown sat in its asset's baseline, followed one edit at a time. One edit changes a
 * node's key or its name, not both, so a step's diff pairs it where a diff from the baseline, seeing both, could not.
 */
export interface NodeOrigins {
  /** The asset `id`'s origins, for `diffSchemas`. */
  of(id: string): OriginOf;
  /** Carry every origin in `before` to the node it became in `after`. */
  follow(before: Workspace, after: Workspace): void;
}

/** Origins seeded from `base`, each of its nodes at its own path. */
export function trackOrigins(base: Workspace): NodeOrigins {
  const byAsset = new Map<string, WeakMap<SchemaNode, string>>();
  const mapOf = (id: string) => {
    let map = byAsset.get(id);
    if (!map) byAsset.set(id, (map = new WeakMap()));
    return map;
  };
  for (const asset of base.assets) {
    const map = mapOf(asset.id);
    for (const [path, node] of flatten(asset.root)) if (!map.has(node)) map.set(node, path);
  }
  return {
    of: (id) => {
      const map = byAsset.get(id);
      return (node) => map?.get(node);
    },
    follow(before, after) {
      for (const asset of after.assets) {
        const was = assetOf(before, asset.id)?.root;
        if (was === undefined || was === asset.root) continue;
        const map = mapOf(asset.id);
        const a = flatten(was);
        const b = flatten(asset.root);
        for (const [from, to] of pairNodes(was, asset.root).pairs) {
          const origin = map.get(a.get(from)!);
          const next = b.get(to)!;
          if (origin !== undefined && !map.has(next)) map.set(next, origin);
        }
      }
    },
  };
}
