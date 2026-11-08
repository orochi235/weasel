import { hidesSubtree } from 'core/scene/nodeGates';
import { adapterDerivedPathOf } from './adapterDerivedPath';
import type { AdapterPickGates, PickCandidate, PickSource } from './pickWalk';

/** The adapter surface the walk can reach without a `Scene`. */
interface PickAdapter<TPose> {
  /** Composed world pose, when the adapter has a composition strategy.
   *  Falls back to `getPose`, which is the same value under the
   *  absolute-pose model. */
  getWorldPose?(id: string): TPose;
  getPose(id: string): TPose;
  getNode(id: string): unknown;
  getChildren(parentId: string | null): readonly string[];
}

/**
 * A source over a bare `SelectAdapter`, for consumers with no `Scene`.
 *
 * The adapter's tree is walked depth-first, parents before children — the
 * same back-to-front order `renderOrderNodes` produces for a single layer.
 *
 * A hidden subtree and the children a node consumes are not walked, and a node
 * is locked when it or a node above it says so, as `buildSceneTree` paints and
 * `nodeGates` locks. `gates` come from whichever view is picking, never from the adapter.
 */
export function adapterPickSource<TPose>(
  adapter: PickAdapter<TPose>,
  gates: AdapterPickGates = {},
): PickSource<TPose> {
  // Rebuilt per walk: the tree may have changed between queries, and a walk
  // is the only thing that reads it.
  let parents = new Map<string, PickCandidate<TPose>>();
  let locked = new Set<string>();

  // The adapter composes if it has a strategy; `getPose` alone is the node's
  // own pose, which is not where a framed child is drawn.
  const worldPose = (id: string): TPose =>
    (typeof adapter.getWorldPose === 'function' ? adapter.getWorldPose(id) : adapter.getPose(id));

  const derived = adapterDerivedPathOf(adapter);
  const nodeOf = (id: string): PickCandidate<TPose> => {
    const raw = adapter.getNode(id) as Partial<PickCandidate<TPose>>;
    return { ...raw, id, pose: worldPose(id) } as PickCandidate<TPose>;
  };

  return {
    order() {
      const out: PickCandidate<TPose>[] = [];
      const next = new Map<string, PickCandidate<TPose>>();
      const nextLocked = new Set<string>();
      const visit = (parentId: string | null, parent: PickCandidate<TPose> | null, lockedAbove: boolean): void => {
        for (const childId of adapter.getChildren(parentId)) {
          const node = nodeOf(childId) as PickCandidate<TPose> & { hidden?: boolean; locked?: boolean; consumesChildren?: boolean };
          if (hidesSubtree(node)) continue;
          if (parent) next.set(childId, parent);
          const isLocked = lockedAbove || node.locked === true;
          if (isLocked) nextLocked.add(childId);
          out.push(node);
          if (node.consumesChildren !== true) visit(childId, node, isLocked);
        }
      };
      visit(null, null, false);
      parents = next;
      locked = nextLocked;
      return out;
    },
    ...(gates.alphaOf ? { alphaOf: gates.alphaOf } : {}),
    ...(gates.layerIsPainted ? { layerIsPainted: gates.layerIsPainted } : {}),
    ...(gates.planeOf ? { planeOf: gates.planeOf } : {}),
    poseOf: (node) => worldPose(node.id),
    isLocked: (node) => locked.has(node.id),
    derivedPathOf: (node: PickCandidate<TPose>) => derived(node.id),
    parentsOf(node) {
      const chain: PickCandidate<TPose>[] = [];
      let cur = parents.get(node.id);
      const seen = new Set<string>();
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        chain.push(cur);
        cur = parents.get(cur.id);
      }
      return chain;
    },
  };
}
