/**
 * Whether a marquee or a lasso takes one node: the per-node decision shared by
 * `sceneToAdapter` (through `canvas/deps/hitTestArea`) and `arrayAdapter`.
 *
 * What a node draws is not knowable here — the painters sit above `core/` — so
 * the caller hands in the node's outline as a thunk, asked for only when the
 * bounds cannot decide. A pose that is itself a polygon path is its own
 * outline and never asks.
 */
import {
  boxContainsBox,
  pointInPolygon,
  polygonContainsPath,
  polygonIntersectsPath,
  type Path,
  type PolygonPath,
} from '@weasel-js/geom';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { LassoHitMode } from 'core/adapters/types';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { Vec2 } from './vec2';
import { poseRotationOf, rotatePathAround } from './poseRotation';
import { visualBoundsViaDescriptor, type PoseDescriptor } from './poseDescriptor';

/** A closed selection area: a marquee rect or a lasso polygon. */
export interface SelectRegion {
  /** The area's vertices; the closing edge back to the first is implicit. */
  readonly verts: readonly Vec2[];
  /** `verts` interleaved as `[x0, y0, x1, y1, …]`. */
  readonly coords: readonly number[];
  readonly bounds: Bounds;
  /** True when the area is its own bounding rect, so a node inside `bounds`
   *  is inside the area without further work. Never true for a lasso: a node
   *  inside the hull's box can still miss the hull. */
  readonly isRect: boolean;
}

/** A marquee's region. */
export function rectRegion(r: Bounds): SelectRegion {
  const { x, y, width: w, height: h } = r;
  return regionOf([x, y, x + w, y, x + w, y + h, x, y + h], { x, y, width: w, height: h }, true)!;
}

/** A region from interleaved coords. `bounds` is derived when omitted; `null`
 *  when there are no coords to bound. */
export function regionOf(
  coords: ArrayLike<number>,
  bounds?: Bounds,
  isRect = false,
): SelectRegion | null {
  const verts: Vec2[] = [];
  const flat: number[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < coords.length; i += 2) {
    const x = coords[i], y = coords[i + 1];
    verts.push({ x, y });
    flat.push(x, y);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (verts.length === 0) return null;
  return {
    verts,
    coords: flat,
    bounds: bounds ?? { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    isRect,
  };
}

/** A lasso's region, or `null` for fewer than three vertices. */
export function polygonRegion(polygon: ReadonlyArray<Vec2>): SelectRegion | null {
  if (polygon.length < 3) return null;
  const coords: number[] = [];
  for (const p of polygon) coords.push(p.x, p.y);
  return regionOf(coords);
}

/** A pose that is its own drawn outline. */
export function isSilhouettePose(pose: unknown): pose is PolygonPath {
  return pose !== null && typeof pose === 'object' && (pose as Path).kind === 'polygon';
}

/**
 * The box a region fast-rejects a node against: a silhouette pose's own bounds,
 * else the pose's visual bounds — which for a rotated pose is the box of its
 * rotated ink, reaching past the pose box. `g` is the node's descriptor.
 */
export function regionBoundsOf(node: object, pose: unknown, g: PoseDescriptor<unknown>): Bounds {
  // Memo is silhouettes-only: a rect pose's bounds are the pose itself, and
  // memoizing it costs more than it saves. The result may be shared; never mutate it.
  return isSilhouettePose(pose)
    ? nodeMemo(node, 'aabb', pose, () => g.getBounds(pose))
    : visualBoundsViaDescriptor(pose, g);
}

/** The outline of a node nothing paints: its pose rect, turned by the pose's
 *  rotation, else its visual bounds `b`. */
export function poseOutline(pose: unknown, b: Bounds): Path {
  const r = poseRotationOf(pose);
  if (r) {
    const p = pose as Bounds;
    return rotatePathAround(
      { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      r.cx, r.cy, r.rotation,
    );
  }
  return { kind: 'rect', x: b.x, y: b.y, width: b.width, height: b.height };
}

/**
 * Whether `region` takes a node under `mode`, given its pose, its bounds `b`
 * from {@link regionBoundsOf}, and its drawn outline on demand.
 *
 * - `intersect` — the outline meets the region anywhere.
 * - `enclosed` — the whole outline lies inside it.
 * - `centers` — the center of `b` lies inside it.
 *
 * A node without finite bounds is never taken.
 */
export function regionTakes(
  region: SelectRegion,
  mode: LassoHitMode,
  pose: unknown,
  b: Bounds,
  outline: () => Path,
): boolean {
  if (
    !Number.isFinite(b.x) || !Number.isFinite(b.y) ||
    !Number.isFinite(b.width) || !Number.isFinite(b.height)
  ) {
    return false;
  }
  const ab = region.bounds;
  if (
    b.x >= ab.x + ab.width || b.x + b.width <= ab.x ||
    b.y >= ab.y + ab.height || b.y + b.height <= ab.y
  ) {
    return false;
  }
  if (mode === 'centers') {
    return pointInPolygon(region.coords, b.x + b.width / 2, b.y + b.height / 2);
  }
  const inBox = boxContainsBox(
    [ab.x, ab.y, ab.x + ab.width, ab.y + ab.height],
    [b.x, b.y, b.x + b.width, b.y + b.height],
  );
  const silhouette = isSilhouettePose(pose);
  if (mode === 'enclosed') {
    // A node sticking out of the region's box cannot be inside the region.
    if (!inBox) return false;
    return polygonContainsPath(region.verts, silhouette ? pose : outline());
  }
  // Swallowed whole by a marquee: no outline can change the answer.
  if (region.isRect && inBox) return true;
  if (silhouette) return polygonIntersectsPath(region.verts, pose);
  const drawn = outline();
  // An axis-aligned rect overlapping a marquee's box already meets it.
  if (drawn.kind === 'rect' && region.isRect) return true;
  return polygonIntersectsPath(region.verts, drawn);
}
