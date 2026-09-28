/**
 * Shared, silhouette-aware area hit-test used by both `areaSelect` (marquee)
 * and `lassoSelect` dep sources, and by `sceneToAdapter`.
 *
 * The per-node decision is `regionTakes` (`core/geometry/regionHit`), which
 * `arrayAdapter` shares. This module supplies the scene walk — layers, clips,
 * pose composition, containers — and the node's drawn outline: the painter's
 * world-frame silhouette (`findShapeSilhouette`), which is what reaches the
 * kit's own inserted shapes, whose geometry sits on `node.data` behind a bare
 * `{x,y,w,h}` pose. With no painter the outline is the pose rect, rotated if
 * the pose is.
 */
import type { Scene, NodeId } from 'core/scene/types';
import { pathIntersectsRect } from 'features/paths/pathHitTest';
import type { LassoHitMode } from 'core/adapters/types';
import {
  poseDescriptorForNode,
  visualBoundsViaDescriptor,
  type PoseDescriptor,
} from 'interactions/actions/resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import {
  pickWalk,
  scenePickSource,
  type ScenePickSourceOptions,
} from 'canvas/pickWalk';

export { hiddenLayerIds } from 'canvas/pickWalk';
import type { HitTestView } from 'interactions/actions/depSchema';
import type { PoseComposition } from 'features/groups/composePose';
import { findShapeSilhouette } from 'canvas/NodeShape';
import {
  polygonRegion,
  poseOutline,
  rectRegion,
  regionBoundsOf,
  regionOf,
  regionTakes,
  type SelectRegion,
} from 'core/geometry/regionHit';

export interface AABBBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What a region query takes back beyond leaves. */
export interface RegionQueryOptions {
  /** Default `false`: a region that takes a container and its children
   *  selects the same ink twice. A bare-adapter consumer, which has nothing
   *  to fold children back into their container, asks for them. */
  includeContainers?: boolean;
}


/** The pick options a region dep hands the shared walk: the asking view's
 *  layer gate, the surface's alpha, and the scene's pose composition. */
export function regionPickOptions(
  view: HitTestView | undefined,
  alphaOf: ((id: string) => number) | undefined,
  poseComposition: PoseComposition<unknown> | undefined,
): ScenePickSourceOptions<unknown> {
  return {
    ...(poseComposition ? { poseComposition } : {}),
    ...(alphaOf ? { alphaOf } : {}),
    ...(view?.layerIsPainted ? { layerIsPainted: (layer: string) => view.layerIsPainted!(layer) } : {}),
  };
}

/** Marquee entry point: every node the rect `bounds` meets. */
export function hitTestArea(
  scene: Scene<unknown, string, unknown>,
  bounds: AABBBounds,
  opts?: ScenePickSourceOptions<unknown>,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
  query: RegionQueryOptions = {},
): NodeId[] {
  return walkArea(scene, rectRegion(bounds), 'intersect', opts, descriptor, query);
}

/**
 * Every node an arbitrary closed area polygon meets. `area` is interleaved
 * `[x0,y0,x1,y1,…]`; `areaBounds` is its AABB, derived when omitted.
 */
export function hitTestAreaPolygon(
  scene: Scene<unknown, string, unknown>,
  area: ArrayLike<number>,
  areaBounds?: AABBBounds,
  /** True when `area` IS its own bounding rect, so `areaBounds` containment
   *  implies containment in the area proper. Never pass this for a lasso
   *  polygon — a node inside the hull's box can miss the hull. */
  areaIsRect = false,
  /** The asking view's alpha and layer accessors. A bare scene answers for
   *  itself; a view that dims or reorders layers has to supply its own. */
  opts?: ScenePickSourceOptions<unknown>,
  /** How to read this scene's poses. Default `AUTO_POSE_DESCRIPTOR`. */
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
  query: RegionQueryOptions = {},
): NodeId[] {
  const region = regionOf(area, areaBounds, areaIsRect);
  return region ? walkArea(scene, region, 'intersect', opts, descriptor, query) : [];
}

/**
 * Lasso entry point: which nodes a closed lasso polygon picks under `mode`
 * (see `regionTakes`).
 */
export function hitTestLassoPolygon(
  scene: Scene<unknown, string, unknown>,
  polygon: ReadonlyArray<{ x: number; y: number }>,
  mode: LassoHitMode,
  opts?: ScenePickSourceOptions<unknown>,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
  query: RegionQueryOptions = {},
): NodeId[] {
  const region = polygonRegion(polygon);
  return region ? walkArea(scene, region, mode, opts, descriptor, query) : [];
}

/** The walk every region query shares: skip containers unless asked, gate on
 *  the clip, and let `regionTakes` decide each node. */
function walkArea(
  scene: Scene<unknown, string, unknown>,
  region: SelectRegion,
  mode: LassoHitMode,
  opts: ScenePickSourceOptions<unknown> | undefined,
  descriptor: PoseDescriptor<unknown>,
  query: RegionQueryOptions,
): NodeId[] {
  return pickWalk<unknown>(scenePickSource(scene, opts), {
    includeContainers: query.includeContainers === true,
    clipAdmits: (clip, node, pose) => {
      const g = poseDescriptorForNode(descriptor, node);
      return pathIntersectsRect(clip, visualBoundsViaDescriptor(pose, g))
        && pathIntersectsRect(clip, region.bounds);
    },
    hits: (node, pose) => {
      // The descriptor sees the node here, so a pose shape whose extent
      // depends on `node.data` bounds itself rather than its pose's default.
      const g = poseDescriptorForNode(descriptor, node);
      const b = regionBoundsOf(node as object, pose, g);
      return regionTakes(region, mode, pose, b, () =>
        findShapeSilhouette(node as never, pose) ?? poseOutline(pose, b));
    },
  }) as NodeId[];
}
