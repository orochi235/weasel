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
 *      polygon via the kernel: a hit when ANY silhouette vertex is inside the
 *      area, OR ANY area vertex is inside the silhouette, OR ANY silhouette
 *      edge crosses ANY area edge. This drops AABB false-positives (marquee
 *      grazes an empty corner of the AABB) and rescues silhouettes the old
 *      AABB test would have selected only by luck.
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
import { pathIntersectsRect, polygonContainsPath } from 'features/paths/pathHitTest';
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
import { pointInPolygon, rectToContour, segmentsCross } from '@weasel-js/geom';
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
): NodeId[] {
  const { x, y, width: w, height: h } = bounds;
  const area = Array.from(rectToContour(x, y, w, h));
  return hitTestAreaPolygon(scene, area, { x, y, width: w, height: h }, true, opts, descriptor);
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
): NodeId[] {
  const ab = areaBounds ?? boundsOf(area);
  if (!ab) return [];
  return walkArea(scene, ab, opts, descriptor, (node, pose, b, silhouette) => {
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
      return silhouetteOverlapsArea((pose as PolygonPath).coords, area);
    }

    // 4. Everything else — the kit's own inserted shapes among them, which
    // carry a bare `{x,y,w,h}` pose and keep their geometry on `data`. Test
    // the node's world-frame outline. An axis-aligned rect against a rect
    // marquee was already answered by the fast-reject; against a lasso it
    // still has to meet the polygon.
    const outline = outlineOf(node, pose, b);
    if (outline.kind === 'polygon') {
      return silhouetteOverlapsArea(outline.coords, area);
    }
    return areaIsRect
      || silhouetteOverlapsArea(rectToContour(outline.x, outline.y, outline.width, outline.height), area);
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
): NodeId[] {
  if (polygon.length < 3) return [];
  const area: number[] = [];
  for (const p of polygon) area.push(p.x, p.y);
  if (mode === 'intersect') {
    return hitTestAreaPolygon(scene, area, undefined, false, opts, descriptor);
  }
  const ab = boundsOf(area);
  if (!ab) return [];
  return walkArea(scene, ab, opts, descriptor, (node, pose, b, silhouette) => {
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
 * The walk every region query shares: skip containers, gate on the clip, and
 * AABB fast-reject each leaf against `ab` before `hits` sees it with the
 * node's visual bounds `b` and whether its pose is itself a silhouette.
 */
function walkArea(
  scene: Scene<unknown, string, unknown>,
  ab: AABBBounds,
  opts: ScenePickSourceOptions<unknown> | undefined,
  descriptor: PoseDescriptor<unknown>,
  hits: (node: unknown, pose: unknown, b: AABBBounds, silhouette: boolean) => boolean,
): NodeId[] {
  return pickWalk<unknown>(scenePickSource(scene, opts), {
    // A marquee that returns a container *and* its children selects the same
    // ink twice; the container comes back through the selection's own
    // parent-folding instead.
    includeContainers: false,
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

/**
 * Standard polygon-overlap test between a silhouette contour and an area
 * polygon, both interleaved & implicitly closed. Covers all three overlap
 * modes:
 *   - any silhouette vertex inside the area  (silhouette ⊂ area, or partial)
 *   - any area vertex inside the silhouette  (area ⊂ silhouette)
 *   - any silhouette edge crossing any area edge (boundary intersection)
 */
function silhouetteOverlapsArea(sil: ArrayLike<number>, area: ArrayLike<number>): boolean {
  const ns = sil.length >> 1;
  const na = area.length >> 1;
  if (ns < 1 || na < 3) return false;

  // Any silhouette vertex inside the area.
  for (let i = 0; i < ns; i++) {
    if (pointInPolygon(area, sil[i * 2], sil[i * 2 + 1])) return true;
  }
  // Any area vertex inside the silhouette.
  for (let i = 0; i < na; i++) {
    if (pointInPolygon(sil, area[i * 2], area[i * 2 + 1])) return true;
  }
  // Any silhouette edge crossing any area edge (implicit closing edges).
  for (let i = 0, j = ns - 1; i < ns; j = i++) {
    const ax = sil[j * 2], ay = sil[j * 2 + 1];
    const bx = sil[i * 2], by = sil[i * 2 + 1];
    for (let k = 0, l = na - 1; k < na; l = k++) {
      const cx = area[l * 2], cy = area[l * 2 + 1];
      const dx = area[k * 2], dy = area[k * 2 + 1];
      if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) return true;
    }
  }
  return false;
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
