/** The pick source over a `Scene`: its render order, painted poses and gates,
 *  and, given a descriptor, the pick index that narrows the walk. */
import type { Path } from '@weasel-js/geom';
import type { DerivedDep, Node, NodeId, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import { annotationLayerIds } from 'core/scene/annotation';
import { nodeGates } from 'core/scene/nodeGates';
import { planeMap, type ParallaxOpts, type PlaneMap } from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { resolveDerivedPath, scenePaintedPoseOf } from './derivedPath';
import { indexedCandidates } from './pickIndex/scenePickIndex';
import type { PickBroad, PickCandidate, PickSource, ViewPickGates } from './pickWalk';
import { sceneParentsOf, sceneShownPathOf } from './scenePickReads';
import { nodeAsShown, nodesAsShown } from './shownNodes';

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
  /** Box every node once per scene change, so a query carrying a `broad` box
   *  visits only the nodes it can hit. `descriptor` must be the one the
   *  query reads poses through. */
  index?: { descriptor: PoseDescriptor<unknown> };
}

export function scenePickSource<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  opts: ScenePickSourceOptions<TPose> = {},
): PickSource<TPose> {
  // Partial scene stand-ins carry only `layers` and `get`, which is all the gates read.
  const gates = nodeGates(scene as never);
  const enumerable = typeof scene.overrides?.ids === 'function';
  // Pick candidates carry a plain string id; the scene answers them all the same.
  const asShown = <N extends { id: string; data?: unknown }>(node: N): N =>
    (scene.overrides ? nodeAsShown(scene.overrides, node as N & { id: NodeId }) : node);
  const allAsShown = <N extends { id: string; data?: unknown }>(nodes: readonly N[]): readonly N[] =>
    (enumerable ? nodesAsShown(scene.overrides, nodes as readonly (N & { id: NodeId })[]) : nodes.map(asShown));
  const annotations = annotationLayerIds(scene.layers);
  const { getPose, alphaOf, layerIsPainted } = opts;

  // Resolved once per walk rather than once per candidate. Needs enumeration — a
  // partial scene stand-in carrying only `read` falls back to reading per node.
  let faded: Set<string> | null = null;
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
    const stored = scene.get(id);
    if (stored === undefined) return undefined;
    const dep = asShown(stored);
    return {
      node: dep as Node<unknown, string, TPose>,
      pose: poseOf(dep as never),
      get path(): Path | null {
        return resolveDerivedPath(dep as never, depOf, childrenOf);
      },
    };
  };

  const derivedPathOf = getPose
    ? (node: PickCandidate<TPose>): Path | null => {
      const n = node as unknown as Node<TData, TLayer, TPose>;
      return n.dependsOn === undefined ? null : resolveDerivedPath(n, depOf, childrenOf);
    }
    : sceneShownPathOf(scene);

  const planeOf = opts.camera ? scenePlaneOf(scene.layers, opts.camera) : null;

  // The index boxes nodes at the scene's painted poses; a custom `getPose` must be shown to agree first.
  // A partial stand-in has no versions for it to key on.
  const index = getPose || typeof scene.getVersion !== 'function' ? undefined : opts.index;
  return {
    ...(planeOf ? { planeOf } : {}),
    ...(index ? {
      candidates: (broadFor: (layer: string | undefined) => PickBroad | null | undefined) => {
        const found = indexedCandidates(scene as never, index.descriptor, broadFor) as readonly PickCandidate<TPose>[] | null;
        return found === null ? null : allAsShown(found);
      },
    } : {}),
    order: () => allAsShown(scene.renderOrderNodes() as unknown as readonly PickCandidate<TPose>[]),
    derivedPathOf,
    poseOf,
    parentsOf: sceneParentsOf(scene),
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
