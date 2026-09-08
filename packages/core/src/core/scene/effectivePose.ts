/**
 * `effectivePose` — the pose to draw, pick and measure a node at.
 *
 * Three answers, in order: the ephemeral override a gesture published, the
 * pose the node derives from its dependencies, or the pose the document
 * stores. Reading `node.pose` directly is how the render and hit-test paths
 * came to disagree about where a node is, and a derived pose widens that gap
 * from "mid-drag" to "always".
 */
import { dependencyIdsOf } from './dependents';
import { dropPoseKeyedMemoSlots, nodeMemo } from './nodeMemo';
import type { NodeId, PoseOverrides } from './types';

const SLOT = 'kit:derivedPose';

/** The subset of a node this module reads. Structural so a `Node` satisfies
 *  it without importing the full generic shape. */
export interface PosedNode<TPose> {
  id: NodeId;
  kind?: 'leaf' | 'container';
  pose: TPose;
  /** Read only by the memo, which keys on its reference alongside the pose. */
  data?: unknown;
  dependsOn?: readonly NodeId[] | 'children';
  derivePose?: (
    node: never,
    deps: readonly ({ node: never; pose: TPose } | undefined)[],
  ) => TPose | null;
}

/** What resolving a pose needs: the overrides, and enough of the scene to
 *  reach a node's dependencies. A `Scene` satisfies it. */
export interface PoseSource<TPose> {
  readonly overrides: Pick<PoseOverrides<TPose>, 'get'>;
  get(id: NodeId): PosedNode<TPose> | undefined;
  childrenOf(id: NodeId): readonly NodeId[];
}

/** Ids whose derivation is on the stack. A dependency graph is meant to be
 *  acyclic and `dependsOn` is unvalidated, so a cycle resolves to the authored
 *  pose at whichever node closes it rather than overflowing the stack. */
const resolving = new Set<NodeId>();

/** Bumped each time the guard above fires. A derivation that closed a cycle
 *  answered from a fallback rather than from its dependencies, so its value is
 *  an artifact of which node was asked first and must not be cached. */
let cycleHits = 0;

/**
 * The pose `node` computes from its dependencies, or `null` when it derives
 * nothing — it has no `derivePose`, nothing to derive from, or its
 * `derivePose` returned `null`.
 *
 * A dependency is read through {@link effectivePose}, so a group of groups
 * resolves bottom-up and a dragged dependency's override reaches the
 * derivation the same frame it is published.
 */
export function derivedPose<TPose>(
  source: PoseSource<TPose>,
  node: PosedNode<TPose>,
): TPose | null {
  const derive = node.derivePose;
  if (derive === undefined) return null;
  const ids = dependencyIdsOf(node, source.childrenOf);
  if (ids.length === 0) return null;
  if (resolving.has(node.id)) {
    cycleHits++;
    return null;
  }
  resolving.add(node.id);
  const hitsBefore = cycleHits;
  try {
    // Keyed on the authored pose, which is what `dropPoseKeyedMemoSlots`
    // clears — the same push-invalidation the derived path rides on.
    const value = nodeMemo(node, SLOT, node.pose, () =>
      derive(
        node as never,
        ids.map((id) => {
          const dep = source.get(id);
          return dep === undefined
            ? undefined
            : { node: dep as never, pose: effectivePose(source, dep) };
        }),
      ),
    );
    if (cycleHits !== hitsBefore) dropPoseKeyedMemoSlots(node);
    return value;
  } finally {
    resolving.delete(node.id);
  }
}

/**
 * The pose the *document* says `node` is at: derived when it derives, else
 * authored. `effectivePose` minus the override step.
 *
 * For a reader that must not see an in-flight gesture — an action capturing
 * the `from` of a transform op, a placement computed against a sibling. A
 * derived pose belongs here and an override does not: derivation is what the
 * document means, an override is what one gesture is currently showing.
 */
export function documentPose<TPose>(
  source: PoseSource<TPose>,
  node: PosedNode<TPose>,
): TPose {
  return derivedPose(source, node) ?? node.pose;
}

/**
 * The pose to draw, pick and measure `node` at.
 *
 * The one rule. Every pose a reader acts on comes from here: the three render
 * walks, the pick walk, the adapters tools and actions commit through.
 */
export function effectivePose<TPose>(
  source: PoseSource<TPose>,
  node: PosedNode<TPose>,
): TPose {
  const override = source.overrides.get(node.id)?.pose;
  if (override !== undefined) return override;
  return derivedPose(source, node) ?? node.pose;
}
