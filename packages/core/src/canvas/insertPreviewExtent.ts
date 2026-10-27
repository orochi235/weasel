/**
 * The one answer to "how big is the thing this in-flight insert is making",
 * shared by the preview paint, the commit, and the gesture's reported bounds.
 *
 * The drag AABB alone is NOT the answer. `insertAction` hands over an
 * `extras` payload that can carry richer geometry than the drag rect, and
 * where it does, that geometry is the shape: a pencil that loops back to its
 * start produces a zero-area drag rect around a trail that swept the page.
 */
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { OngoingOverlay } from '@weasel-js/routing';
import { boundsOfPath, regularPolygonPath, starPath, type Path, type Point } from '@weasel-js/geom';

/** The fields of an `insertPreview` overlay this needs. `canvas/deps/insert`
 *  passes the equivalent from its own `(bounds, extras)` commit arguments. */
export interface InsertPreviewLike {
  shape: string;
  bounds: { x: number; y: number; width: number; height: number };
  extras: unknown;
}

/** Resolved preview geometry, in the terms the path builders take. */
export type InsertPreviewGeometry =
  | { kind: 'box' }
  | { kind: 'line'; a: Point; b: Point }
  | { kind: 'polygon'; center: Point; radius: number; sides: number; rotation: number }
  | {
      kind: 'star';
      center: Point;
      outerRadius: number;
      innerRadius: number;
      points: number;
      rotation: number;
    }
  | { kind: 'pencil'; samples: ReadonlyArray<Point> };

/** An in-flight insert's shape, resolved from its drag rect and `extras`. */
export interface InsertPreviewExtent {
  /** The insert kind, verbatim from the caller. */
  shape: string;
  /** World-space AABB of `geometry` — the extent. */
  bounds: Bounds;
  geometry: InsertPreviewGeometry;
}

/** The `insertPreview` member of `OngoingOverlay`, which `insertAction` publishes during a drag-to-insert. */
export type InsertPreviewOverlay = Extract<OngoingOverlay, { kind: 'insertPreview' }>;

/** Resolve an in-flight insert's geometry and world AABB. Uses the geometry in
 *  `extras` where the shape carries it; an unknown shape falls back to its drag rect. */
export function insertPreviewExtent(ov: InsertPreviewLike): InsertPreviewExtent {
  const b = ov.bounds;
  const box = { x: b.x, y: b.y, width: b.width, height: b.height };

  switch (ov.shape) {
    case 'line': {
      const e = ov.extras as Partial<{ a: Point; b: Point }>;
      const a = e.a ?? { x: b.x, y: b.y };
      const b2 = e.b ?? { x: b.x + b.width, y: b.y + b.height };
      return { shape: ov.shape, bounds: aabbOf([a, b2]) ?? box, geometry: { kind: 'line', a, b: b2 } };
    }
    case 'polygon': {
      const e = ov.extras as Partial<{
        sides: number; rotation: number; center: Point; radius: number;
      }>;
      const center = e.center ?? { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      const radius = e.radius ?? Math.min(b.width, b.height) / 2;
      const sides = Math.max(3, Math.floor(e.sides ?? 6));
      const rotation = e.rotation ?? 0;
      return {
        shape: ov.shape,
        bounds: boxOf(regularPolygonPath(center, radius, sides, rotation)),
        geometry: { kind: 'polygon', center, radius, sides, rotation },
      };
    }
    case 'star': {
      const e = ov.extras as Partial<{
        points: number; innerRadiusRatio: number; rotation: number;
        center: Point; outerRadius: number;
      }>;
      const center = e.center ?? { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      const outerRadius = e.outerRadius ?? Math.min(b.width, b.height) / 2;
      const innerRadius = outerRadius * (e.innerRadiusRatio ?? 0.5);
      const points = Math.max(3, Math.floor(e.points ?? 5));
      const rotation = e.rotation ?? 0;
      return {
        shape: ov.shape,
        bounds: boxOf(starPath(center, outerRadius, points, innerRadius, rotation)),
        geometry: { kind: 'star', center, outerRadius, innerRadius, points, rotation },
      };
    }
    case 'pencil': {
      const e = ov.extras as Partial<{ samples: ReadonlyArray<Point> }>;
      const samples = e.samples ?? [];
      return {
        shape: ov.shape,
        bounds: aabbOf(samples) ?? box,
        geometry: { kind: 'pencil', samples },
      };
    }
    default:
      return { shape: ov.shape, bounds: box, geometry: { kind: 'box' } };
  }
}

/** A radial shape's extent is the box of the shape it makes, as the commit stores it. */
function boxOf(path: Path): Bounds {
  const { x, y, width, height } = boundsOfPath(path);
  return { x, y, width, height };
}

function aabbOf(pts: ReadonlyArray<Point>): Bounds | null {
  if (pts.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
