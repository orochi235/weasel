import type { View } from './view';

/** One value for both axes, or a separate value per axis. */
export type ScalarOrXY = number | { x: number; y: number };

/** How a parallax plane tracks the camera: `pan` is the fraction of the
 *  camera's translation it follows (1 = locked to the scene, 0 = fixed to the
 *  screen), `zoom` the same for scale, and `anchor` the camera position
 *  (`view.x` / `view.y`) the translation is measured from — every plane lines
 *  up when the camera sits there. */
export interface ParallaxOpts {
  pan: ScalarOrXY;
  zoom?: ScalarOrXY;
  anchor?: { x: number; y: number };
}

function asXY(v: ScalarOrXY): { x: number; y: number } {
  return typeof v === 'number' ? { x: v, y: v } : v;
}

/**
 * Pure derivation of a parallax plane's inner `View` from the camera view
 * plus per-plane factors.
 *
 * `pan` controls how much the plane translates with the camera (1 = normal,
 * 0 = locked to `anchor`, >1 = leads). `zoom` controls how much it scales
 * with camera zoom (1 = normal, 0 = fixed at identity scale). `anchor`
 * (default origin) is the camera position at which all planes agree.
 *
 * Identity holds: `pan=1, zoom=1` returns a view equal to `outer`.
 */
export function deriveParallaxView(outer: View, opts: ParallaxOpts): View {
  const p = asXY(opts.pan);
  const z = asXY(opts.zoom ?? 1);
  const a = opts.anchor ?? { x: 0, y: 0 };
  return {
    x: a.x + (outer.x - a.x) * p.x,
    y: a.y + (outer.y - a.y) * p.y,
    scale: {
      x: 1 + (outer.scale.x - 1) * z.x,
      y: 1 + (outer.scale.y - 1) * z.y,
    },
  };
}

/** How a point of the camera's world lands in a plane's world, per axis:
 *  `plane = world * scale + offset`. A plane draws its content through its
 *  own view; this is what lets a pointer, a marquee or a selection box cross
 *  between that view and the camera's. */
export interface PlaneMap {
  scale: { x: number; y: number };
  offset: { x: number; y: number };
}

/** The map from `outer`'s world into the world of a plane drawn through
 *  `deriveParallaxView(outer, opts)` — the one that puts both points under the
 *  same pixel. */
export function planeMap(outer: View, opts: ParallaxOpts): PlaneMap {
  const inner = deriveParallaxView(outer, opts);
  const kx = outer.scale.x / inner.scale.x;
  const ky = outer.scale.y / inner.scale.y;
  return {
    scale: { x: kx, y: ky },
    offset: { x: inner.x - kx * outer.x, y: inner.y - ky * outer.y },
  };
}

/** Map a point from the outer view's world into the plane's world. */
export function toPlane(m: PlaneMap, p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x * m.scale.x + m.offset.x, y: p.y * m.scale.y + m.offset.y };
}

/** Map a point from the plane's world back into the outer view's world. */
export function fromPlane(m: PlaneMap, p: { x: number; y: number }): { x: number; y: number } {
  return { x: (p.x - m.offset.x) / m.scale.x, y: (p.y - m.offset.y) / m.scale.y };
}

interface Rect { x: number; y: number; width: number; height: number }

function mapRect(r: Rect, map: (p: { x: number; y: number }) => { x: number; y: number }): Rect {
  const a = map({ x: r.x, y: r.y });
  const b = map({ x: r.x + r.width, y: r.y + r.height });
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** A camera-world rect in the plane's world. The map is axis-aligned, so a
 *  rect stays a rect; a flipped axis is normalized back to a positive size. */
export function rectToPlane<R extends Rect>(m: PlaneMap, r: R): R {
  return { ...r, ...mapRect(r, (p) => toPlane(m, p)) };
}

/** A plane-world rect in the camera's world — see {@link rectToPlane}. */
export function rectFromPlane<R extends Rect>(m: PlaneMap, r: R): R {
  return { ...r, ...mapRect(r, (p) => fromPlane(m, p)) };
}

/** The map from one world into another, where `null` is the camera's own:
 *  `fromPlane(from)`, then `toPlane(to)`. Null when the two are the same
 *  world, so a caller can skip the work. */
export function planeToPlane(from: PlaneMap | null, to: PlaneMap | null): PlaneMap | null {
  if (from === to) return null;
  const f = from ?? IDENTITY_MAP;
  const t = to ?? IDENTITY_MAP;
  const sx = t.scale.x / f.scale.x;
  const sy = t.scale.y / f.scale.y;
  const m = {
    scale: { x: sx, y: sy },
    offset: { x: t.offset.x - f.offset.x * sx, y: t.offset.y - f.offset.y * sy },
  };
  return m.scale.x === 1 && m.scale.y === 1 && m.offset.x === 0 && m.offset.y === 0 ? null : m;
}

const IDENTITY_MAP: PlaneMap = { scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } };

/** The map as an affine matrix in `@weasel-js/geom`'s `[a, b, c, d, e, f]`
 *  order, for `transformPath` and friends. */
export function planeMatrix(m: PlaneMap): [number, number, number, number, number, number] {
  return [m.scale.x, 0, 0, m.scale.y, m.offset.x, m.offset.y];
}
