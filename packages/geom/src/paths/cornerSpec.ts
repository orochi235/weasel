/**
 * Per-anchor corner specs: the stored half of corner shapes. A path carries
 * them in `PolygonPath.corners`, indexed by flat anchor index, and every
 * reader of its geometry sees them expanded (`resolveCorners`).
 */
import type { PolygonPath } from '../path';
import type { CornerShape } from './cornerShape';

/** The corner at one anchor: its shape, and its setback, how far along each
 *  edge from the anchor the cut starts. A `round` corner between edges at a
 *  right angle is a circle of that radius. */
export interface CornerSpec {
  shape: CornerShape;
  radius: number;
}

/** The corner cut at flat anchor `index`, or null. A zero radius cuts nothing. */
export function cornerAt(path: PolygonPath, index: number): CornerSpec | null {
  const spec = path.corners?.[index];
  return spec && spec.radius > 0 ? spec : null;
}

/** The spec stored at flat anchor `index`, radius zero included: a shape
 *  picked before any radius is dragged out. */
export function cornerSpecAt(path: PolygonPath, index: number): CornerSpec | null {
  return path.corners?.[index] ?? null;
}

/** Whether any anchor of `path` carries a corner with a radius. */
export function hasCorners(path: { kind: string; corners?: PolygonPath['corners'] }): boolean {
  const corners = path.corners;
  if (!corners) return false;
  for (const c of corners) if (c && c.radius > 0) return true;
  return false;
}

/** `corners` without trailing empty slots, or undefined when none is left. */
export function compactCorners(
  corners: readonly (CornerSpec | null | undefined)[],
): (CornerSpec | null)[] | undefined {
  let end = corners.length;
  while (end > 0 && !corners[end - 1]) end--;
  if (end === 0) return undefined;
  const out: (CornerSpec | null)[] = new Array(end);
  for (let i = 0; i < end; i++) out[i] = corners[i] ?? null;
  return out;
}

/** `path` without its corner specs: the bare anchors the specs decorate. */
export function withoutCorners(path: PolygonPath): PolygonPath {
  if (path.corners === undefined) return path;
  const { corners: _dropped, ...rest } = path;
  return rest;
}

/** `path` with the corner at flat anchor `index` set to `spec`, or cleared
 *  when `spec` is null. A zero radius keeps the shape and cuts nothing.
 *  Never mutates `path`. */
export function withCorner(path: PolygonPath, index: number, spec: CornerSpec | null): PolygonPath {
  const next: (CornerSpec | null)[] = path.corners ? [...path.corners] : [];
  while (next.length <= index) next.push(null);
  next[index] = spec ? { shape: spec.shape, radius: Math.max(0, spec.radius) } : null;
  const corners = compactCorners(next);
  const bare = withoutCorners(path);
  return corners ? { ...bare, corners } : bare;
}

/** `path` with every corner radius multiplied by `factor`, as a uniform
 *  scale of its geometry would carry them. */
export function scaleCorners(path: PolygonPath, factor: number): PolygonPath {
  if (!path.corners || factor === 1) return path;
  return {
    ...path,
    corners: path.corners.map((c) => (c ? { shape: c.shape, radius: c.radius * factor } : null)),
  };
}
