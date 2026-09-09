/**
 * `resolveDerivedPath` — the path a node computes from its dependencies.
 *
 * It sits beside `derivedPose` rather than in `canvas/` because a *pose* can
 * now derive from a dependency's path: an edge label is positioned along the
 * route it labels, and `effectivePose` is what resolves it. The render walk's
 * wrapper stays in `canvas/derivedPath.ts`.
 *
 * Invalidation here is *pushed* by the scene, never pulled: a pose override
 * mutates its buffer in place, so no comparison this module could make would
 * see a dependency move. The memo is keyed on the node's own pose because that
 * is the slot `dropPoseKeyedMemoSlots` clears.
 */
import type { Path } from 'core/geometry/path';
import { dependencyIdsOf } from './dependents';
import { dropPoseKeyedMemoSlots, nodeMemo } from './nodeMemo';
import type { DerivedDep, NodeId } from './types';

const SLOT = 'kit:derivedPath';

/** The subset of a node this module reads. Structural so a `Node` satisfies it
 *  without importing the full generic shape. */
export interface PathDerivingNode<TPose> {
  id: NodeId;
  pose: TPose;
  /** Read only by the memo, which keys on its reference alongside the pose. */
  data?: unknown;
  dependsOn?: readonly NodeId[] | 'children';
  derivePath?: (
    node: never,
    deps: readonly (DerivedDep<TPose> | undefined)[],
  ) => Path | null;
}

/** Ids whose path is on the stack. A dependency graph is meant to be acyclic
 *  and `dependsOn` is unvalidated; now that a path can read another path, a
 *  cycle has to resolve to `null` at whichever node closes it rather than
 *  overflowing the stack. */
const resolving = new Set<NodeId>();

/** Bumped each time the guard above fires, so a value computed from a
 *  fallback is not cached — it is an artifact of which node was asked first. */
let cycleHits = 0;

/**
 * The path `node` computes from its dependencies, or `null` when it derives
 * from nothing (the normal case) or its `derivePath` has nothing to draw.
 *
 * `depOf` supplies each dependency — its node, the pose it is painted at, and
 * its own path; one it cannot resolve reaches `derivePath` as `undefined`.
 * `childrenOf` answers a node whose `dependsOn` is `'children'`.
 */
export function resolveDerivedPath<TPose>(
  node: PathDerivingNode<TPose>,
  depOf: (id: NodeId) => DerivedDep<TPose> | undefined,
  childrenOf: (id: NodeId) => readonly NodeId[],
): Path | null {
  const derivePath = node.derivePath;
  if (derivePath === undefined) return null;
  const ids = dependencyIdsOf(node, childrenOf);
  if (ids.length === 0) return null;
  if (resolving.has(node.id)) {
    cycleHits++;
    return null;
  }
  resolving.add(node.id);
  const hitsBefore = cycleHits;
  try {
    const value = nodeMemo(node, SLOT, node.pose, () =>
      derivePath(node as never, ids.map((id) => depOf(id))),
    );
    if (cycleHits !== hitsBefore) dropPoseKeyedMemoSlots(node);
    return value;
  } finally {
    resolving.delete(node.id);
  }
}
