/**
 * The one hit-test walk.
 *
 * Four walks used to answer this question — two point queries, two area
 * queries — over the same tree with the same gates. They drifted three times
 * without a failing test, because nothing held them to each other. Everything
 * that decides whether a node *can* be hit lives here now; a query supplies
 * only the shape test and the clip predicate for its own region.
 *
 * The gates, in the order the walk applies them:
 *   1. containers, when the query does not want them
 *   2. the layer is painted at all — scene visibility, and the asking view's
 *      `layerVisibility` / `layerOrder`
 *   3. painted alpha is above zero
 *   4. the query's own shape test
 *   5. every ancestor clip admits the query region
 *
 * 2, 3 and 5 are all "the renderer did not put this on screen". A pick path
 * that skips one answers for a node the user cannot see.
 */

import type { Path } from 'features/paths/types';
import { findShapeSilhouette } from 'canvas/NodeShape';
import type { Node, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import { effectivePose } from 'core/scene/poseOverrides';

/** The subset of a node the walk itself reads. Deliberately structural: a
 *  bare adapter's node satisfies it as readily as a `SceneNode`. */
export interface PickCandidate<TPose> {
  id: string;
  kind?: string;
  layer?: string;
  pose: TPose;
  clipFromPose?: (pose: TPose) => Path | null;
}

/**
 * Everything the walk reads that a **view** owns.
 *
 * A layer must not hold state a view owns, so none of these are closed over
 * at construction — each is asked per walk, of the view being dispatched to.
 */
export interface PickSource<TPose> {
  /** Candidates in paint order, back-to-front. Containers included; the
   *  query decides whether they can be hit. */
  order(): readonly PickCandidate<TPose>[];
  /** The pose the renderer draws — override-aware. Not `node.pose`, which is
   *  how the render and pick paths came to disagree about where a node is. */
  poseOf(node: PickCandidate<TPose>): TPose;
  /** Ancestors, innermost first. Only walked for candidates that already
   *  passed their own shape test. */
  parentsOf(node: PickCandidate<TPose>): readonly PickCandidate<TPose>[];
  /** Painted alpha for the asking view: the view's `alphaFor` times any
   *  per-node override alpha. Omit when the source has no alpha concept. */
  alphaOf?(id: string): number;
  /** Whether this layer reaches the screen in the asking view. Omit for a
   *  source with no layers. */
  layerIsPainted?(layer: string): boolean;
}

/** One hit-test question: what region, and what counts as covering it. */
export interface PickQuery<TPose> {
  /** Default `true`. The area walks exclude containers so a marquee does not
   *  return a container and its children both. */
  includeContainers?: boolean;
  /** Does this node, drawn at this pose, cover the query region? */
  hits(node: PickCandidate<TPose>, pose: TPose): boolean;
  /**
   * Does an ancestor's clip leave anything of `node` for this query to hit?
   *
   * A point query asks point-in-clip and ignores the node. An area query has
   * to ask about the node as well: the clip and the area can overlap where
   * the node is not, and the node and the clip can overlap where the area is
   * not, and only the two terms together reject both.
   */
  clipAdmits(clip: Path, node: PickCandidate<TPose>, pose: TPose): boolean;
}

/** The clip a container imposes on its subtree, or null when it imposes none. */
export function ownClipOf<TPose>(node: PickCandidate<TPose>, pose: TPose): Path | null {
  if (node.kind !== 'container') return null;
  if (typeof node.clipFromPose === 'function') return node.clipFromPose(pose);
  return findShapeSilhouette(node as unknown as Node<unknown, string, TPose>, pose);
}

/**
 * Collect every candidate the query hits, back-to-front — the last element is
 * the topmost, which is the order `pickTopMostHit` expects.
 */
export function pickWalk<TPose>(
  src: PickSource<TPose>,
  q: PickQuery<TPose>,
): string[] {
  const includeContainers = q.includeContainers ?? true;
  const out: string[] = [];

  // Resolving a container's clip means `clipFromPose` or a silhouette build,
  // which is the expensive half; the predicate against it is cheap. So the
  // *path* is memoized per container for the walk and the predicate re-runs
  // per candidate — `clipAdmits` needs the candidate, and caching its answer
  // per container would answer the wrong question for an area query.
  const clipPath = new Map<string, Path | null>();

  const clipOf = (ancestor: PickCandidate<TPose>): Path | null => {
    const cached = clipPath.get(ancestor.id);
    if (cached !== undefined) return cached;
    const resolved = ownClipOf(ancestor, src.poseOf(ancestor));
    clipPath.set(ancestor.id, resolved);
    return resolved;
  };

  for (const node of src.order()) {
    if (!includeContainers && node.kind === 'container') continue;
    if (node.layer !== undefined && src.layerIsPainted?.(node.layer) === false) continue;
    if (src.alphaOf !== undefined && src.alphaOf(node.id) <= 0) continue;

    const pose = src.poseOf(node);
    if (!q.hits(node, pose)) continue;

    let clipped = false;
    for (const ancestor of src.parentsOf(node)) {
      const clip = clipOf(ancestor);
      if (clip !== null && !q.clipAdmits(clip, node, pose)) { clipped = true; break; }
    }
    if (clipped) continue;

    out.push(node.id);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** Layer ids the scene reports as hidden. Only an explicit `false` hides a
 *  layer: a partial scene stand-in that omits the flag stays pickable. */
export function hiddenLayerIds(
  layers: readonly { id: string; visible?: boolean }[] | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const layer of layers ?? []) {
    if (layer.visible === false) out.add(layer.id);
  }
  return out;
}

export interface ScenePickSourceOptions<TPose> {
  /** Pose lookup, when the caller holds an adapter that already resolves
   *  overrides. Defaults to `effectivePose` against the scene's own. */
  getPose?: (id: string) => TPose;
  /** The asking view's composed alpha — `alphaFor(id)` times override alpha.
   *  Defaults to the override alpha alone, which is all a bare scene knows. */
  alphaOf?: (id: string) => number;
  /** The asking view's answer to "does this scene layer reach the screen",
   *  which is `layerVisibility` and `layerOrder` on top of the scene's own
   *  `visible` flag. Consulted after the scene's flag, never instead of it. */
  layerIsPainted?: (layer: string) => boolean;
}

export function scenePickSource<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  opts: ScenePickSourceOptions<TPose> = {},
): PickSource<TPose> {
  const hidden = hiddenLayerIds(scene.layers);
  const { getPose, alphaOf, layerIsPainted } = opts;
  return {
    order: () => scene.renderOrderNodes() as unknown as readonly PickCandidate<TPose>[],
    poseOf: getPose
      ? (node) => getPose(node.id)
      : (node) => effectivePose(scene.overrides, node as never),
    parentsOf(node) {
      const chain: PickCandidate<TPose>[] = [];
      let parentId = (node as { parent?: string | null }).parent ?? null;
      const seen = new Set<string>();
      while (parentId !== null) {
        if (seen.has(parentId)) break;
        seen.add(parentId);
        const parent = scene.get(asNodeId(parentId));
        if (!parent) break;
        chain.push(parent as unknown as PickCandidate<TPose>);
        parentId = parent.parent ?? null;
      }
      return chain;
    },
    alphaOf: alphaOf ?? ((id) => scene.overrides.get(asNodeId(id))?.alpha ?? 1),
    layerIsPainted: (layer) =>
      !hidden.has(layer) && (layerIsPainted === undefined || layerIsPainted(layer)),
  };
}

/** The adapter surface the walk can reach without a `Scene`. */
interface PickAdapter<TPose> {
  getNodes(): readonly { id: string }[];
  getPose(id: string): TPose;
  getNode?: (id: string) => unknown;
  getChildren?: (parentId: string | null) => readonly string[];
}

/**
 * A source over a bare `SelectAdapter`, for consumers with no `Scene`.
 *
 * A hierarchical adapter is walked depth-first, parents before children —
 * the same back-to-front order `renderOrderNodes` produces for a single
 * layer. A flat adapter falls back to `getNodes()`, which carries no
 * parentage, so nothing clips.
 */
export function adapterPickSource<TPose>(adapter: PickAdapter<TPose>): PickSource<TPose> {
  const hier = adapter as Required<Pick<PickAdapter<TPose>, 'getNode' | 'getChildren'>>;
  const hierarchical =
    typeof adapter.getChildren === 'function' && typeof adapter.getNode === 'function';

  // Rebuilt per walk: the tree may have changed between queries, and a walk
  // is the only thing that reads it.
  let parents = new Map<string, PickCandidate<TPose>>();

  const nodeOf = (id: string): PickCandidate<TPose> => {
    const raw = hier.getNode(id) as Partial<PickCandidate<TPose>>;
    return { ...raw, id, pose: adapter.getPose(id) } as PickCandidate<TPose>;
  };

  return {
    order() {
      if (!hierarchical) {
        parents = new Map();
        return adapter.getNodes().map((n) => ({
          ...(n as object), id: n.id, pose: adapter.getPose(n.id),
        })) as PickCandidate<TPose>[];
      }
      const out: PickCandidate<TPose>[] = [];
      const next = new Map<string, PickCandidate<TPose>>();
      const visit = (parentId: string | null, parent: PickCandidate<TPose> | null): void => {
        for (const childId of hier.getChildren(parentId)) {
          const node = nodeOf(childId);
          if (parent) next.set(childId, parent);
          out.push(node);
          visit(childId, node);
        }
      };
      visit(null, null);
      parents = next;
      return out;
    },
    poseOf: (node) => adapter.getPose(node.id),
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
