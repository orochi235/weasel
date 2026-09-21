/**
 * `resolveDerivedPath` — the path a node computes from its dependencies.
 *
 * It sits beside `derivedPose` rather than in `canvas/` because a *pose* can
 * now derive from a dependency's path: an edge label is positioned along the
 * route it labels, and `effectivePose` is what resolves it. The render walk's
 * wrapper stays in `canvas/derivedPath.ts`.
 *
 * Invalidation is both pushed and pulled. The scene pushes — dropping the
 * dependent's memo slot on the edits it performs — and on a memo hit this
 * module re-resolves the dependencies and compares their poses *by value*
 * against the ones the cached path was drawn from. The pull is what covers a
 * dependency that moved with no scene edit behind it: a lookup answering poses
 * of its own (`sceneDepLookup(scene, toPose)`), an ancestor's frame moving, a
 * dependency appearing or going away. Value, not reference: a pose override
 * mutates its buffer in place, so the reference never moves.
 *
 * The pull covers poses only. A derivation is handed each dependency's whole
 * node, so one reading `data` or `layer` still rides on the scene's push.
 */
import type { Path } from 'core/geometry/path';
import { dependencyIdsOf } from './dependents';
import { dropPoseKeyedMemoSlots, nodeMemo } from './nodeMemo';
import { recordDeps, sameDeps, type DepRecord } from './depMemo';
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

/** A cached path, with what it was drawn from. */
interface PathMemo<TPose> extends DepRecord<TPose> {
  path: Path | null;
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
 *
 * `memoSlot` separates a `depOf` that answers different poses than the scene's
 * own — the memo key cannot see which lookup filled it.
 */
export function resolveDerivedPath<TPose>(
  node: PathDerivingNode<TPose>,
  depOf: (id: NodeId) => DerivedDep<TPose> | undefined,
  childrenOf: (id: NodeId) => readonly NodeId[],
  memoSlot: string = SLOT,
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
    let computed = false;
    const record = nodeMemo<PathMemo<TPose>>(node, memoSlot, node.pose, () => {
      computed = true;
      return draw(node, derivePath, ids.map(depOf), { nodes: [], poses: [], path: null });
    });
    // Mutating the record in place is what updates the memo slot, which holds
    // this object.
    if (!computed && !sameDeps(record, ids, depOf)) {
      draw(node, derivePath, ids.map(depOf), record);
    }
    if (cycleHits !== hitsBefore) dropPoseKeyedMemoSlots(node);
    return record.path;
  } finally {
    resolving.delete(node.id);
  }
}

/** Run `derivePath` against `deps` and record what it was run against. */
function draw<TPose>(
  node: PathDerivingNode<TPose>,
  derivePath: NonNullable<PathDerivingNode<TPose>['derivePath']>,
  deps: readonly (DerivedDep<TPose> | undefined)[],
  into: PathMemo<TPose>,
): PathMemo<TPose> {
  into.path = derivePath(node as never, deps);
  recordDeps(into, deps);
  return into;
}

