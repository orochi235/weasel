/**
 * The one hit-test walk. Everything that decides whether a node *can* be hit lives here; a
 * query supplies only the shape test and the clip predicate for its own region.
 *
 * The gates, in the order the walk applies them:
 *   1. containers, when the query does not want them
 *   2. the node is painted at all — not hidden in the scene (`nodeGates`),
 *      and on a layer the asking view's `layerVisibility` / `layerOrder` paints
 *   3. painted alpha is above zero
 *   4. the node is not locked, unless the query asks for locked nodes
 *   5. the query's own shape test
 *   6. every ancestor clip admits the query region
 *
 * 2, 3 and 6 are all "the renderer did not put this on screen". A pick path
 * that skips one answers for a node the user cannot see. 4 is the other axis:
 * a locked node is on screen and still out of reach.
 */

import { invert, type Affine, type Path } from '@weasel-js/geom';
import { findShapeSilhouette } from 'canvas/NodeShape';
import type { ClipFromPoseFn, CopiesFromPoseFn, DerivedDep, Node, NodeId, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import { annotationLayerIds } from 'core/scene/annotation';
import { nodeGates } from 'core/scene/nodeGates';
import { inheritedPaintOf, inheritsPaint, type InheritedPaint } from 'core/scene/inheritedPaint';
import { resolveDerivedPath, sceneDerivedPathOf, scenePaintedPoseOf, showsComputedPath } from './derivedPath';
import { planeMap, type ParallaxOpts, type PlaneMap } from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import { clipCarrier } from './planeClips';
import { reaches } from './pickReach';

/** Shared, never mutated: most scenes are flat and every node returns it. */
const EMPTY_PARENTS: readonly never[] = [];

/** The subset of a node the walk itself reads. Deliberately structural: a
 *  bare adapter's node satisfies it as readily as a `SceneNode`. */
export interface PickCandidate<TPose> {
  id: string;
  kind?: string;
  layer?: string;
  pose: TPose;
  /** `false` makes the node transparent to the walk — see `SceneNode.pickable`. */
  pickable?: boolean;
  /** Read for an `'inherit'` fill or stroke, which takes its containers'. */
  data?: unknown;
  clipFromPose?: ClipFromPoseFn<TPose>;
  copiesFromPose?: CopiesFromPoseFn<TPose>;
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
  /** Whether the node is locked — painted, but not something a pointer can
   *  take. Omit for a source with no lock concept. */
  isLocked?(node: PickCandidate<TPose>): boolean;
  /** Whether the source hides the node, so nothing of it is on screen. Omit
   *  for a source that hides nothing. */
  isHidden?(node: PickCandidate<TPose>): boolean;
  /** The path a node computes from its dependencies, or null for none. */
  derivedPathOf?(node: PickCandidate<TPose>): Path | null;
  /** How the asking view's world maps into a parallax layer's, or null for a
   *  layer that moves with the camera. Omit for a source with no planes. */
  planeOf?(layer: string): PlaneMap | null;
}

/** One hit-test question: what region, and what counts as covering it. */
export interface PickQuery<TPose> {
  /** Default `true`. The area walks exclude containers so a marquee does not
   *  return a container and its children both. */
  includeContainers?: boolean;
  /** Default `false`. Every selecting or editing query passes over locked
   *  nodes; one that only samples what is painted can take them back. */
  includeLocked?: boolean;
  /** Does this node, drawn at this pose, cover the query region? `derived`
   *  is the node's resolved path when it has one — a derived node's pose is a
   *  placeholder, so a region test that reads only the pose answers for the
   *  wrong box. `inherited` is what its `'inherit'` fields take from its
   *  containers, for the ink it is tested against; absent when it inherits
   *  nothing. */
  hits(node: PickCandidate<TPose>, pose: TPose, derived?: Path | null, inherited?: InheritedPaint): boolean;
  /**
   * Does an ancestor's clip leave anything of `node` for this query to hit?
   *
   * A point query asks point-in-clip and ignores the node. An area query has
   * to ask about the node as well: the clip and the area can overlap where
   * the node is not, and the node and the clip can overlap where the area is
   * not, and only the two terms together reject both.
   */
  clipAdmits(
    clip: Path,
    node: PickCandidate<TPose>,
    pose: TPose,
    derived?: Path | null,
  ): boolean;
  /** The same question asked in a parallax plane's world: the region carried
   *  through `map`, and any screen-pixel slop re-derived at the plane's scale.
   *  A query without it cannot reach nodes on a plane — it would test them
   *  where their poses sit rather than where they are painted. */
  inPlane?(map: PlaneMap): PickQuery<TPose>;
  /** The same question carried by `m`, an affine from world into the source
   *  frame of a copy a container draws. A query without it cannot reach
   *  copies — see `ContainerNode.copiesFromPose`. */
  inCopy?(m: Affine): PickQuery<TPose>;
}

/** The clip a container imposes on its subtree, or null when it imposes none. */
export function ownClipOf<TPose>(
  node: PickCandidate<TPose>,
  pose: TPose,
  derived?: Path | null,
): Path | null {
  if (node.kind !== 'container') return null;
  if (typeof node.clipFromPose === 'function') return node.clipFromPose(pose);
  return findShapeSilhouette(
    node as unknown as Node<unknown, string, TPose>,
    pose,
    { derivedPath: derived },
  );
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
  const isLocked = q.includeLocked === true ? undefined : src.isLocked;
  const out: string[] = [];

  // Resolving a container's clip is the expensive half, so the *path* is memoized per
  // container for the walk. The predicate re-runs per candidate: caching its answer per
  // container would answer the wrong question for an area query.
  const clipPath = new Map<string, Path | null>();
  // A clip is in its container's plane; the query is in the candidate's.
  const carry = clipCarrier(src.planeOf ?? null);

  const clipOf = (ancestor: PickCandidate<TPose>): Path | null => {
    const cached = clipPath.get(ancestor.id);
    if (cached !== undefined) return cached;
    const resolved = ownClipOf(
      ancestor, src.poseOf(ancestor), src.derivedPathOf?.(ancestor),
    );
    clipPath.set(ancestor.id, resolved);
    return resolved;
  };

  const copyMaps = new Map<string, readonly Affine[]>();
  const copiesOf = (ancestor: PickCandidate<TPose>): readonly Affine[] => {
    let found = copyMaps.get(ancestor.id);
    if (found === undefined) {
      const fn = ancestor.kind === 'container' ? ancestor.copiesFromPose : undefined;
      const copies = fn ? fn(src.poseOf(ancestor), ancestor as never) ?? [] : [];
      found = copies.map(invert).filter((m): m is Affine => m !== null);
      copyMaps.set(ancestor.id, found);
    }
    return found;
  };

  // One reprojected query per plane per walk; `null` marks a plane this
  // query cannot reach.
  const planeQueries = new Map<string, PickQuery<TPose> | null>();
  const queryFor = (layer: string | undefined): PickQuery<TPose> | null => {
    if (layer === undefined || src.planeOf === undefined) return q;
    let found = planeQueries.get(layer);
    if (found === undefined) {
      const map = src.planeOf(layer);
      found = map === null ? q : (q.inPlane?.(map) ?? null);
      planeQueries.set(layer, found);
    }
    return found;
  };

  const order = src.order();
  const copying = order.some((n) => n.kind === 'container' && typeof n.copiesFromPose === 'function');
  for (const node of order) {
    if (!includeContainers && node.kind === 'container') continue;
    // Transparent to picking: the click belongs to whatever is behind it,
    // which for a label inside a box is the box.
    if (node.pickable === false) continue;
    if (src.isHidden?.(node) === true) continue;
    if (node.layer !== undefined && src.layerIsPainted?.(node.layer) === false) continue;
    if (src.alphaOf !== undefined && src.alphaOf(node.id) <= 0) continue;
    if (isLocked !== undefined && isLocked(node)) continue;

    const query = queryFor(node.layer);
    if (query === null) continue;
    const pose = src.poseOf(node);
    const derived = src.derivedPathOf?.(node);
    const inherited = inheritsPaint(node) ? inheritedPaintOf(node, src.parentsOf(node)) : undefined;
    if (!reaches(node, pose, derived, inherited, query, () => src.parentsOf(node), copying, { clipOf, copiesOf, carry })) continue;
    out.push(node.id);
  }

  return out;
}

/**
 * The two answers a pick needs from the view it is asked for rather than from
 * the data behind it: how that view paints a node, and whether it paints a
 * layer at all. A scene and a bare adapter take the same pair.
 */
export interface ViewPickGates {
  /** Painted alpha: the view's `alphaFor` times any per-node override alpha.
   *  A node painted at alpha 0 cannot be hit. */
  alphaOf?: (id: string) => number;
  /** Whether a node's `layer` reaches the screen in the asking view. */
  layerIsPainted?: (layer: string) => boolean;
}

/** The gates a bare adapter takes from its view, plus how that view's camera
 *  maps into each parallax layer — see `scenePlaneOf`. */
export interface AdapterPickGates extends ViewPickGates {
  planeOf?: (layer: string) => PlaneMap | null;
}

export interface ScenePickSourceOptions<TPose> extends ViewPickGates {
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
  /** The asking view's camera. With it, a layer carrying `parallax` is picked
   *  through its plane; without it, every layer is taken to move with the
   *  camera. */
  camera?: View;
}

export function scenePickSource<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  opts: ScenePickSourceOptions<TPose> = {},
): PickSource<TPose> {
  // Partial scene stand-ins carry only `layers` and `get`, which is all the gates read.
  const gates = nodeGates(scene as never);
  const annotations = annotationLayerIds(scene.layers);
  const { getPose, alphaOf, layerIsPainted } = opts;

  // Resolved once per walk rather than once per candidate. Needs enumeration — a
  // partial scene stand-in carrying only `read` falls back to reading per node.
  let faded: Set<string> | null = null;
  const enumerable = typeof scene.overrides?.ids === 'function';
  if (!alphaOf && enumerable) {
    for (const id of scene.overrides.ids()) {
      const a = scene.overrides.read(id)?.alpha;
      if (a !== undefined && a <= 0) (faded ??= new Set()).add(id);
    }
  }
  const readAlpha = alphaOf
    ?? (enumerable
      ? (faded ? (id: string) => (faded.has(id) ? 0 : 1) : undefined)
      : (id: string) => scene.overrides.read(asNodeId(id))?.alpha ?? 1);

  // A composing strategy makes a node's own pose local, so picking folds the
  // parent chain the same way the render walk does: one definition of both.
  const paintedPoseOf = scenePaintedPoseOf(scene);
  const poseOf = getPose
    ? (node: PickCandidate<TPose>) => getPose(node.id)
    : (node: PickCandidate<TPose>) => paintedPoseOf(node as never);

  // Through `poseOf`, not the document pose: a derived node has to be tested
  // where the renderer draws its dependencies, which is what an override says.
  const childrenOf = (id: NodeId): readonly NodeId[] => scene.childrenOf(id);
  const depOf = (id: NodeId): DerivedDep<TPose> | undefined => {
    const dep = scene.get(id);
    if (dep === undefined) return undefined;
    return {
      node: dep as Node<unknown, string, TPose>,
      pose: poseOf(dep as never),
      get path(): Path | null {
        return resolveDerivedPath(dep as never, depOf, childrenOf);
      },
    };
  };

  const sceneDerivedPath = getPose ? null : sceneDerivedPathOf(scene);
  const derivedPathOf = (node: PickCandidate<TPose>): Path | null => {
    const n = node as unknown as Node<TData, TLayer, TPose>;
    if (!sceneDerivedPath) return n.dependsOn === undefined ? null : resolveDerivedPath(n, depOf, childrenOf);
    return showsComputedPath(scene, n) ? sceneDerivedPath(n) : null;
  };

  const planeOf = opts.camera ? scenePlaneOf(scene.layers, opts.camera) : null;

  return {
    ...(planeOf ? { planeOf } : {}),
    order: () => scene.renderOrderNodes() as unknown as readonly PickCandidate<TPose>[],
    derivedPathOf,
    poseOf,
    parentsOf(node) {
      let parentId = (node as { parent?: string | null }).parent ?? null;
      if (parentId === null) return EMPTY_PARENTS;
      const chain: PickCandidate<TPose>[] = [];
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
    // Absent entirely when nothing is faded, so the walk skips the gate.
    ...(readAlpha ? { alphaOf: readAlpha } : {}),
    isLocked: (node: PickCandidate<TPose>) => gates.locked(node.id),
    isHidden: (node: PickCandidate<TPose>) => gates.hidden(node.id),
    ...(annotations.size > 0 || layerIsPainted
      ? {
        layerIsPainted: (layer: string) =>
          !annotations.has(layer) && (layerIsPainted === undefined || layerIsPainted(layer)),
      }
      : {}),
  };
}

/** Each parallax layer's plane map under `camera`, or null when no layer is a
 *  plane — which keeps the per-layer lookup off the walk entirely. */
export function scenePlaneOf(
  layers: readonly { id: string; parallax?: ParallaxOpts }[] | undefined,
  camera: View,
): ((layer: string) => PlaneMap | null) | null {
  let maps: Map<string, PlaneMap> | null = null;
  for (const l of layers ?? []) {
    if (l.parallax) (maps ??= new Map()).set(l.id, planeMap(camera, l.parallax));
  }
  if (maps === null) return null;
  const found = maps;
  return (layer) => found.get(layer) ?? null;
}

export { adapterPickSource } from './adapterPickSource';
