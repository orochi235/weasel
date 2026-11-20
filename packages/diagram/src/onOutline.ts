/**
 * Moving a port from the node's bounding box onto the shape it is drawn as.
 *
 * A port is placed as a fraction of the node's bounds, which is what makes it
 * survive a resize. For a rect that is already on the outline; for anything
 * else it can be well outside the ink — a parallelogram's west port floats in
 * the gap beside its leaning edge, and an edge that ends there ends in empty
 * space. So the point is cast back onto the outline along the ray from the
 * node's center, which is the direction an edge leaves anyway.
 */
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, flattenCubic, type Path } from '@weasel-js/core/math';
import { outlinePath, type Bounds, type Outline } from './outline';
import type { Port } from './types';
import { worldCoords, type PolygonPath } from '@weasel-js/geom';

/** Curve flattening tolerance, in world units. Finer than a port is wide. */
const TOLERANCE = 0.25;

/** The outline as one polyline, `[x0, y0, x1, y1, …]`: each of its subpaths
 *  closed, one after another. Where the outline has more than one subpath, the
 *  step from one to the next is no part of it; cast rays at
 *  {@link outlineRings}, which keeps them apart. */
export function outlinePolyline(outline: Outline, bounds: Bounds): number[] {
  return outlineRings(outline, bounds).flat();
}

/** The outline as closed rings, one per subpath: `[[x0, y0, x1, y1, …], …]`.
 *  A person's head and body are two. */
export function outlineRings(outline: Outline, bounds: Bounds): number[][] {
  return flattenRings(outlinePath(outline, bounds));
}

function flattenRings(path: Path): number[][] {
  if (path.kind === 'rect') {
    const { x, y, width: w, height: h } = path;
    return [[x, y, x + w, y, x + w, y + h, x, y + h, x, y]];
  }
  const rings: number[][] = [];
  let out: number[] = [];
  // Close it, so a ray leaving through the last edge still finds a crossing.
  const end = () => {
    if (out.length >= 2 && (out[0] !== out[out.length - 2] || out[1] !== out[out.length - 1])) out.push(out[0]!, out[1]!);
    if (out.length >= 4) rings.push(out);
    out = [];
  };
  const { commands } = path as PolygonPath;
  const coords = worldCoords(path as PolygonPath);
  let ci = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const cmd of commands) {
    if (cmd === PATH_M) {
      end();
      cx = coords[ci]!; cy = coords[ci + 1]!; ci += 2;
      sx = cx; sy = cy;
      out.push(cx, cy);
    } else if (cmd === PATH_L) {
      cx = coords[ci]!; cy = coords[ci + 1]!; ci += 2;
      out.push(cx, cy);
    } else if (cmd === PATH_C) {
      const x1 = coords[ci]!, y1 = coords[ci + 1]!;
      const x2 = coords[ci + 2]!, y2 = coords[ci + 3]!;
      const x3 = coords[ci + 4]!, y3 = coords[ci + 5]!;
      ci += 6;
      flattenCubic(cx, cy, x1, y1, x2, y2, x3, y3, TOLERANCE, out);
      cx = x3; cy = y3;
    } else if (cmd === PATH_Q) {
      // Elevated to a cubic rather than given its own flattener.
      const qx = coords[ci]!, qy = coords[ci + 1]!;
      const x3 = coords[ci + 2]!, y3 = coords[ci + 3]!;
      ci += 4;
      flattenCubic(
        cx, cy,
        cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy),
        x3 + (2 / 3) * (qx - x3), y3 + (2 / 3) * (qy - y3),
        x3, y3, TOLERANCE, out,
      );
      cx = x3; cy = y3;
    } else if (cmd === PATH_Z) {
      out.push(sx, sy);
      cx = sx; cy = sy;
    }
  }
  end();
  return rings;
}

/**
 * Where the ray from `center` through `point` last crosses `poly`, or `null`
 * when it never does. `poly` is one closed polyline, or several rings
 * ({@link outlineRings}), crossed as one outline with no step between them.
 *
 * The *last* crossing rather than the first: a concave outline can be crossed
 * more than once, and the far side is the boundary an edge should attach to.
 */
export function rayHit(
  poly: readonly number[] | readonly (readonly number[])[],
  center: { x: number; y: number },
  point: { x: number; y: number },
): { x: number; y: number } | null {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (dx === 0 && dy === 0) return null;
  const rings = (poly.length > 0 && typeof poly[0] !== 'number' ? poly : [poly]) as readonly (readonly number[])[];
  let bestT = -Infinity;
  for (const ring of rings) {
    for (let i = 0; i + 3 < ring.length; i += 2) {
      const ax = ring[i]!, ay = ring[i + 1]!;
      const ex = ring[i + 2]! - ax;
      const ey = ring[i + 3]! - ay;
      const denom = dx * ey - dy * ex;
      if (denom === 0) continue;
      // t along the ray, u along the segment.
      const t = ((ax - center.x) * ey - (ay - center.y) * ex) / denom;
      const u = ((ax - center.x) * dy - (ay - center.y) * dx) / denom;
      if (t >= 0 && u >= 0 && u <= 1 && t > bestT) bestT = t;
    }
  }
  return bestT === -Infinity ? null : { x: center.x + dx * bestT, y: center.y + dy * bestT };
}

/**
 * Every port moved onto `outline`. A port the ray misses — one at the node's
 * dead center, with no direction to cast along — is left where it was.
 */
export function portsOnOutline(
  ports: readonly Port[],
  outline: Outline,
  bounds: Bounds,
): Port[] {
  if (bounds.width <= 0 || bounds.height <= 0) return [...ports];
  const poly = outlineRings(outline, bounds);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return ports.map((port) => {
    const hit = rayHit(poly, center, port.point);
    return hit === null ? port : { ...port, point: hit };
  });
}
