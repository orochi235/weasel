/**
 * The one answer to "how big is the thing this in-flight insert is making".
 *
 * A drag-to-insert has no scene node until commit, so three surfaces have to
 * size the nascent shape themselves: `useDispatcherOverlayLayer` (paints the
 * preview), `canvas/deps/insert` (poses the committed node) and
 * `dispatcherGestureBounds` (reports the gesture's world AABB to `<Canvas>`).
 * They all resolve it here.
 *
 * The drag AABB alone is NOT the answer. `insertAction` hands over an
 * `extras` payload that can carry richer geometry than the drag rect —
 * a polygon's center+radius, a pencil's sample trail, a line's endpoints —
 * and where it does, that geometry is the shape. A centered Alt-drag
 * produces a `d`-wide drag rect around a `d√2` circumradius; a pencil that
 * loops back to its start produces a zero-area drag rect around a trail that
 * swept the page.
 */
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { OngoingOverlay } from 'interactions/actions/invoker';

type Point = { x: number; y: number };

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

export interface InsertPreviewExtent {
  /** The insert kind, verbatim from the caller. */
  shape: string;
  /** World-space AABB of `geometry` — the extent. */
  bounds: Bounds;
  geometry: InsertPreviewGeometry;
}

export type InsertPreviewOverlay = Extract<OngoingOverlay, { kind: 'insertPreview' }>;

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
      return {
        shape: ov.shape,
        bounds: radialBox(center, radius),
        geometry: {
          kind: 'polygon',
          center,
          radius,
          sides: Math.max(3, Math.floor(e.sides ?? 6)),
          rotation: e.rotation ?? 0,
        },
      };
    }
    case 'star': {
      const e = ov.extras as Partial<{
        points: number; innerRadiusRatio: number; rotation: number;
        center: Point; outerRadius: number;
      }>;
      const center = e.center ?? { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      const outerRadius = e.outerRadius ?? Math.min(b.width, b.height) / 2;
      return {
        shape: ov.shape,
        bounds: radialBox(center, outerRadius),
        geometry: {
          kind: 'star',
          center,
          outerRadius,
          innerRadius: outerRadius * (e.innerRadiusRatio ?? 0.5),
          points: Math.max(3, Math.floor(e.points ?? 5)),
          rotation: e.rotation ?? 0,
        },
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

/** A radial shape's extent is its circumscribed square, not the drag rect. */
function radialBox(center: Point, radius: number): Bounds {
  return { x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2 };
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
