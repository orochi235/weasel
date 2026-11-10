import type { NodeId, Scene } from 'core/scene/types';

type AnyScene = Scene<unknown, string, unknown>;

/** What ungrouping `containers` does beyond moving their children: what removing the containers takes, once the
 *  children have moved out, and the derivations it cuts instead of taking a node it must keep. */
export interface UngroupReach {
  /** The children it frees, in each container's child order, outermost container first. */
  freed: NodeId[];
  /** Every node the batch removes: the containers, and the dependents their removal cascades to. */
  removed: ReadonlySet<NodeId>;
  /** Nodes that keep their place but lose the sources the batch removes, each with the sources to drop. */
  released: ReadonlyMap<NodeId, ReadonlySet<NodeId>>;
}

function descendants(scene: AnyScene, id: NodeId, out: NodeId[]): NodeId[] {
  for (const kid of scene.childrenOf(id)) {
    out.push(kid);
    descendants(scene, kid, out);
  }
  return out;
}

/** Each node's direct dependents: the nodes naming it in a `dependsOn` list. */
function dependentsIndex(scene: AnyScene): Map<NodeId, NodeId[]> {
  const index = new Map<NodeId, NodeId[]>();
  for (const node of scene.nodes.values()) {
    if (!Array.isArray(node.dependsOn)) continue;
    for (const source of node.dependsOn as readonly NodeId[]) {
      const list = index.get(source);
      if (list) list.push(node.id); else index.set(source, [node.id]);
    }
  }
  return index;
}

/**
 * Ungrouping keeps every child it frees, and the ancestors they land in (ruled 2026-11-09): where removing a
 * container would cascade to one of those, or to anything inside a freed child, that node drops the removed
 * source from its `dependsOn` instead. Any other dependent goes with the container, as a delete takes it.
 *
 * Walks the tree as it stands once the children have moved: a container's own subtree is gone from it, and an
 * ancestor holds the children it now receives.
 */
export function ungroupReach(scene: AnyScene, containers: readonly NodeId[]): UngroupReach {
  const dissolving = new Set(containers);
  const freed: NodeId[] = [];
  const kept = new Set<NodeId>();
  const depth = (id: NodeId): number => scene.ancestorsOf(id).length;
  for (const id of [...containers].sort((x, y) => depth(x) - depth(y))) {
    for (const kid of scene.childrenOf(id)) {
      if (dissolving.has(kid)) continue;
      freed.push(kid);
      kept.add(kid);
      for (const d of descendants(scene, kid, [])) kept.add(d);
    }
    for (const a of scene.ancestorsOf(id)) if (!dissolving.has(a)) kept.add(a);
  }

  const index = dependentsIndex(scene);
  const removed = new Set<NodeId>(dissolving);
  const released = new Map<NodeId, Set<NodeId>>();
  const queue = [...dissolving];
  while (queue.length > 0) {
    const source = queue.shift()!;
    for (const dependent of index.get(source) ?? []) {
      if (removed.has(dependent)) continue;
      if (kept.has(dependent)) {
        const sources = released.get(dependent);
        if (sources) sources.add(source); else released.set(dependent, new Set([source]));
        continue;
      }
      // Not a kept node, so not an ancestor of a container either: its subtree is as it stands.
      for (const taken of [dependent, ...descendants(scene, dependent, [])]) {
        if (removed.has(taken)) continue;
        removed.add(taken);
        queue.push(taken);
      }
    }
  }
  return { freed, removed, released };
}

/** Every node ungrouping `containers` would move, rewrite, or remove: what a lock on any of them refuses. */
export function ungroupTouches(reach: UngroupReach): NodeId[] {
  return [...reach.freed, ...reach.removed, ...reach.released.keys()];
}
