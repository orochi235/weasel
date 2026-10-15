/**
 * Per-anchor corner specs: the stored half of corner shapes. A path carries
 * them in `PolygonPath.corners`, indexed by flat anchor index, and every
 * reader of its geometry sees them expanded (`resolveCorners`).
 */
import type { PolygonPath } from '../path';

/** How a corner is cut: a tangent arc, a straight bevel, or an arc centered
 *  on the anchor that scoops into the shape. */
export type CornerStyle = 'round' | 'chamfer' | 'inverted';

/** The corner at one anchor. For `round`, `radius` is the fillet circle's;
 *  for `chamfer` and `inverted`, it is how far the cut runs along each edge
 *  from the anchor, which is also an inverted arc's radius. */
export interface CornerSpec {
  style: CornerStyle;
  radius: number;
}

/** The order cycling a corner's style steps through. */
export const CORNER_STYLES: readonly CornerStyle[] = ['round', 'chamfer', 'inverted'];

/** The style after `style` in {@link CORNER_STYLES}, wrapping. */
export function nextCornerStyle(style: CornerStyle): CornerStyle {
  return CORNER_STYLES[(CORNER_STYLES.indexOf(style) + 1) % CORNER_STYLES.length];
}

/** The corner cut at flat anchor `index`, or null. A zero radius cuts nothing. */
export function cornerAt(path: PolygonPath, index: number): CornerSpec | null {
  const spec = path.corners?.[index];
  return spec && spec.radius > 0 ? spec : null;
}

/** The spec stored at flat anchor `index`, radius zero included: a style
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
 *  when `spec` is null. A zero radius keeps the style and cuts nothing.
 *  Never mutates `path`. */
export function withCorner(path: PolygonPath, index: number, spec: CornerSpec | null): PolygonPath {
  const next: (CornerSpec | null)[] = path.corners ? [...path.corners] : [];
  while (next.length <= index) next.push(null);
  next[index] = spec ? { style: spec.style, radius: Math.max(0, spec.radius) } : null;
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
    corners: path.corners.map((c) => (c ? { style: c.style, radius: c.radius * factor } : null)),
  };
}
