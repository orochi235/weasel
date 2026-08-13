/**
 * Shared, silhouette-aware area hit-test used by both `areaSelect` (marquee)
 * and `lassoSelect` dep sources.
 *
 * For each scene leaf:
 *   1. AABB fast-reject — if the pose's bounding box doesn't intersect the
 *      area's bounds, skip (cheap; keeps the polygon kernel off the hot path).
 *   2. RECT poses (plain `{x,y,w,h}` poses and `RectPath` — the silhouette IS
 *      the bounding box) → AABB-vs-area overlap counts as a hit. This is the
 *      historical `hitTestAABB` behavior, preserved byte-for-byte for rects.
 *   3. SILHOUETTE poses (`PolygonPath`) → test the silhouette against the area
 *      polygon via the kernel: a hit when ANY silhouette vertex is inside the
 *      area, OR ANY area vertex is inside the silhouette, OR ANY silhouette
 *      edge crosses ANY area edge. This drops AABB false-positives (marquee
 *      grazes an empty corner of the AABB) and rescues silhouettes the old
 *      AABB test would have selected only by luck.
 *
 * The "area" is a closed polygon. Marquee passes a rect (converted to its four
 * corners here). Lasso currently passes its bounding rect through `hitTestArea`
 * (silhouette-aware within that rect); `hitTestAreaPolygon` is the shared
 * polygon entry a true lasso-polygon hit-test would route through.
 */
import type { Scene, NodeId } from 'core/scene/types';
import { nodeMemo } from 'core/scene/nodeMemo';
import { aabbOfPose } from 'canvas/SceneCanvas/poseGeometry';
import { pointInPolygon, segmentsCross } from '@weasel-js/geom';
import type { Path, PolygonPath } from 'features/paths/types';

export interface AABBBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Closed area polygon as interleaved [x0,y0,x1,y1,…]; closing edge implicit. */
type AreaCoords = ArrayLike<number>;

/**
 * Marquee entry point: rect bounds. Converts the rect to its four corners and
 * delegates to the polygon hit-test so marquee and lasso share one silhouette
 * code path.
 */
export function hitTestArea(
  scene: Scene<unknown, string, unknown>,
  bounds: AABBBounds,
): NodeId[] {
  const { x, y, width: w, height: h } = bounds;
  const area = [x, y, x + w, y, x + w, y + h, x, y + h];
  return hitTestAreaPolygon(scene, area, { x, y, width: w, height: h });
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
): NodeId[] {
  const ab = areaBounds ?? boundsOf(area);
  if (!ab) return [];
  const hits: NodeId[] = [];
  const order = scene.renderOrderNodes();
  for (let i = 0; i < order.length; i++) {
    const node = order[i];
    if (node.kind === 'container') continue;
    const pose = node.pose;
    // `isPathLike(pose) && pose.kind !== 'rect'` inlined: this runs per node and
    // the predicate call cost 16% of the scan over a 10,000-rect scene.
    const silhouette = pose !== null && typeof pose === 'object'
      && (pose as Path).kind === 'polygon';

    // 1. AABB fast-reject. Memo is silhouettes-only — `aabbOfPose` answers a
    // rect pose by identity, so memoizing one costs more than it saves.
    // `b` may be shared across queries; never mutate it.
    const b = silhouette
      ? nodeMemo(node, 'aabb', pose, () => aabbOfPose(pose))
      : aabbOfPose(pose);
    // Match the historical hitTestAABB skip: a pose without finite numeric
    // bounds (neither path-like nor a plain x/y/w/h rect) is not hit-tested.
    if (
      !Number.isFinite(b.x) ||
      !Number.isFinite(b.y) ||
      !Number.isFinite(b.width) ||
      !Number.isFinite(b.height)
    ) {
      continue;
    }
    if (
      b.x >= ab.x + ab.width ||
      b.x + b.width <= ab.x ||
      b.y >= ab.y + ab.height ||
      b.y + b.height <= ab.y
    ) {
      continue;
    }

    // 2. RECT poses: silhouette IS the AABB → fast-reject pass == hit.
    if (!silhouette) {
      hits.push(node.id);
      continue;
    }

    // 3. SILHOUETTE poses: kernel polygon-overlap against the area polygon.
    if (silhouetteOverlapsArea((pose as PolygonPath).coords, area)) {
      hits.push(node.id);
    }
  }
  return hits;
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
