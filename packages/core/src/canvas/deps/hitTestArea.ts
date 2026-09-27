/**
 * Shared, silhouette-aware area hit-test used by both `areaSelect` (marquee)
 * and `lassoSelect` dep sources.
 *
 * For each scene leaf:
 *   1. AABB fast-reject — if the pose's bounding box doesn't intersect the
 *      area's bounds, skip (cheap; keeps the polygon kernel off the hot path).
 *   2. Containment (rect marquee only) — a node whose AABB is swallowed whole
 *      is a hit no silhouette can overturn, so neither the kernel nor the
 *      painter runs.
 *   3. SILHOUETTE poses (`PolygonPath`) → test the silhouette against the area
 *      polygon with `polygonIntersectsPath`: curves flattened, the fill rule
 *      honored, and an open subpath read as a line rather than an area. This
 *      drops AABB false-positives (marquee grazes an empty corner of the AABB)
 *      and rescues silhouettes the old AABB test would have selected only by
 *      luck.
 *   4. Every other pose → ask the painter for the drawn silhouette
 *      (`findShapeSilhouette`, world frame, memoized per node) and run the same
 *      kernel test on it. This is what reaches the kit's own inserted shapes,
 *      which keep their geometry on `node.data` behind a bare `{x,y,w,h}` pose.
 *      With no painter the outline is the pose rect, rotated if the pose is.
 *      An axis-aligned rect against a rect marquee is a hit on AABB overlap.
 *
 * The "area" is a closed polygon. Marquee passes a rect (converted to its four
 * corners here); lasso passes its own polygon through `hitTestLassoPolygon`,
 * whose `intersect` mode is `hitTestAreaPolygon`.
 */
import type { Scene, NodeId } from 'core/scene/types';
import { nodeMemo } from 'core/scene/nodeMemo';
import {
  pathIntersectsRect,
  polygonContainsPath,
  polygonIntersectsPath,
} from 'features/paths/pathHitTest';
import type { Vec2 } from 'core/geometry/vec2';
import { poseRotationOf, rotatePathAround } from 'features/paths/poseRotation';
import { rectPath } from 'features/paths/builder';
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
import { aabbOfPose } from 'canvas/SceneCanvas/poseGeometry';
import { pointInPolygon, rectToContour } from '@weasel-js/geom';
import { findShapeSilhouette } from 'canvas/NodeShape';
import type { Path, PolygonPath } from 'features/paths/types';

export interface AABBBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Closed area polygon as interleaved [x0,y0,x1,y1,…]; closing edge implicit. */
type AreaCoords = ArrayLike<number>;

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

/**
 * Marquee entry point: rect bounds. Converts the rect to its four corners and
 * delegates to the polygon hit-test so marquee and lasso share one silhouette
 * code path.
 */
export function hitTestArea(
  scene: Scene<unknown, string, unknown>,
  bounds: AABBBounds,
  opts?: ScenePickSourceOptions<unknown>,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
  query: RegionQueryOptions = {},
): NodeId[] {
  const { x, y, width: w, height: h } = bounds;
  const area = Array.from(rectToContour(x, y, w, h));
  return hitTestAreaPolygon(scene, area, { x, y, width: w, height: h }, true, opts, descriptor, query);
}

/**
 * Lasso entry point: an arbitrary closed area polygon. `areaBounds` is the
 * area's AABB (used for the per-node fast-reject); callers that have it cheaply
 * should pass it, otherwise it is derived from `area`.
 */
export function hitTestAreaPolygon(
  scene: Scene<unknown, string, unknown>,
  area: AreaCoords,
  areaBounds?: AABBBounds,
  /** True when `area` IS its own bounding rect, so `areaBounds` containment
   *  implies containment in the area proper. Lets a node swallowed whole by
   *  the marquee answer without any silhouette work. Never pass this for a
   *  lasso polygon — a node inside the hull's box can miss the hull. */
  areaIsRect = false,
  /** The asking view's alpha and layer accessors. A bare scene answers for
   *  itself; a view that dims or reorders layers has to supply its own. */
  opts?: ScenePickSourceOptions<unknown>,
  /** How to read this scene's poses. Default `AUTO_POSE_DESCRIPTOR`. */
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
  query: RegionQueryOptions = {},
): NodeId[] {
  const ab = areaBounds ?? boundsOf(area);
  if (!ab) return [];
  const areaVerts: Vec2[] = [];
  for (let i = 0; i + 1 < area.length; i += 2) areaVerts.push({ x: area[i], y: area[i + 1] });
  return walkArea(scene, ab, opts, descriptor, query, (node, pose, b, silhouette) => {
    // 2. Swallowed whole by a rect marquee — no silhouette can change the
    // answer, so skip the kernel and the painter lookup both.
    if (
      areaIsRect &&
      b.x >= ab.x && b.y >= ab.y &&
      b.x + b.width <= ab.x + ab.width &&
      b.y + b.height <= ab.y + ab.height
    ) {
      return true;
    }

    // 3. SILHOUETTE poses: kernel polygon-overlap against the area polygon.
    if (silhouette) {
      return polygonIntersectsPath(areaVerts, pose as PolygonPath);
    }

    // 4. Everything else — the kit's own inserted shapes among them, which
    // carry a bare `{x,y,w,h}` pose and keep their geometry on `data`. Test
    // the node's world-frame outline. An axis-aligned rect against a rect
    // marquee was already answered by the fast-reject; against a lasso it
    // still has to meet the polygon.
    const outline = outlineOf(node, pose, b);
    if (outline.kind === 'rect' && areaIsRect) return true;
    return polygonIntersectsPath(areaVerts, outline);
  });
}

/**
 * Lasso entry point: which nodes a closed lasso polygon picks under `mode`.
 *
 * - `intersect` — the node's outline meets the polygon anywhere
 *   ({@link hitTestAreaPolygon}).
 * - `enclosed` — the whole outline lies inside the polygon.
 * - `centers` — the center of the node's visual bounds lies inside it.
 *
 * The outline is the pose itself for a polygon pose, else the painter's
 * world-frame silhouette, else the pose's rect with its rotation applied.
 */
export function hitTestLassoPolygon(
  scene: Scene<unknown, string, unknown>,
  polygon: ReadonlyArray<{ x: number; y: number }>,
  mode: LassoHitMode,
  opts?: ScenePickSourceOptions<unknown>,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
  query: RegionQueryOptions = {},
): NodeId[] {
  if (polygon.length < 3) return [];
  const area: number[] = [];
  for (const p of polygon) area.push(p.x, p.y);
  if (mode === 'intersect') {
    return hitTestAreaPolygon(scene, area, undefined, false, opts, descriptor, query);
  }
  const ab = boundsOf(area);
  if (!ab) return [];
  return walkArea(scene, ab, opts, descriptor, query, (node, pose, b, silhouette) => {
    if (mode === 'centers') {
      return pointInPolygon(area, b.x + b.width / 2, b.y + b.height / 2);
    }
    // A node sticking out of the lasso's box cannot be inside the lasso.
    if (
      b.x < ab.x || b.y < ab.y ||
      b.x + b.width > ab.x + ab.width ||
      b.y + b.height > ab.y + ab.height
    ) {
      return false;
    }
    const outline = silhouette ? (pose as PolygonPath) : outlineOf(node, pose, b);
    return polygonContainsPath(polygon, outline);
  });
}

/**
 * The walk every region query shares: skip containers unless asked, gate on
 * the clip, and AABB fast-reject each node against `ab` before `hits` sees it
 * with the node's visual bounds `b` and whether its pose is itself a
 * silhouette.
 */
function walkArea(
  scene: Scene<unknown, string, unknown>,
  ab: AABBBounds,
  opts: ScenePickSourceOptions<unknown> | undefined,
  descriptor: PoseDescriptor<unknown>,
  query: RegionQueryOptions,
  hits: (node: unknown, pose: unknown, b: AABBBounds, silhouette: boolean) => boolean,
): NodeId[] {
  return pickWalk<unknown>(scenePickSource(scene, opts), {
    includeContainers: query.includeContainers === true,
    clipAdmits: (clip, node, pose) => {
      const g = poseDescriptorForNode(descriptor, node);
      return pathIntersectsRect(clip, visualBoundsViaDescriptor(pose, g))
        && pathIntersectsRect(clip, ab);
    },
    hits: (node, pose) => {
      // The descriptor sees the node here, so a pose shape whose extent
      // depends on `node.data` bounds itself rather than its pose's default.
      const g = poseDescriptorForNode(descriptor, node);
      // `isPathLike(pose) && pose.kind !== 'rect'` inlined: this runs per node
      // and the predicate call cost 16% of the scan over a 10,000-rect scene.
      const silhouette = pose !== null && typeof pose === 'object'
        && (pose as Path).kind === 'polygon';

      // 1. AABB fast-reject. Memo is silhouettes-only — `aabbOfPose` answers a
      // rect pose by identity, so memoizing one costs more than it saves.
      // `b` may be shared across queries; never mutate it.
      // Rotated poses expand to the AABB of their ink: a 100x20 rect at 45 deg
      // spans far outside its own box, and an un-expanded fast-reject drops the
      // marquee before the silhouette test can claim it.
      const b = silhouette
        ? nodeMemo(node as never, 'aabb', pose, () => aabbOfPose(pose, g))
        : visualBoundsViaDescriptor(pose, g);
      // Match the historical hitTestAABB skip: a pose without finite numeric
      // bounds (neither path-like nor a plain x/y/w/h rect) is not hit-tested.
      if (
        !Number.isFinite(b.x) ||
        !Number.isFinite(b.y) ||
        !Number.isFinite(b.width) ||
        !Number.isFinite(b.height)
      ) {
        return false;
      }
      if (
        b.x >= ab.x + ab.width ||
        b.x + b.width <= ab.x ||
        b.y >= ab.y + ab.height ||
        b.y + b.height <= ab.y
      ) {
        return false;
      }
      return hits(node, pose, b, silhouette);
    },
  }) as NodeId[];
}

/** A non-silhouette node's world-frame outline: the painter's silhouette when
 *  it has one, else its pose rect — rotated when the pose rotates, since `b`
 *  is then the rotated ink's AABB rather than the rect itself. */
function outlineOf(node: unknown, pose: unknown, b: AABBBounds): Path {
  const drawn = findShapeSilhouette(node as never, pose);
  if (drawn) return drawn;
  const r = poseRotationOf(pose);
  if (r) {
    const p = pose as { x: number; y: number; width: number; height: number };
    return rotatePathAround(rectPath(p.x, p.y, p.width, p.height), r.cx, r.cy, r.rotation);
  }
  return rectPath(b.x, b.y, b.width, b.height);
}

function boundsOf(coords: ArrayLike<number>): AABBBounds | null {
  if (coords.length < 2) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < coords.length; i += 2) {
    const x = coords[i], y = coords[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
