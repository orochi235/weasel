import type { FracPoint, FracRect } from './types';

/** A mark's box in its target's world: CSS pixels at zoom 1. Matches weasel's
 *  default `RectPose`, which is what the scene stores. */
export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a fraction lands on a content box of this size. */
export function fracToWorld(f: FracRect, content: { w: number; h: number }): WorldRect {
  return {
    x: f.x * content.w,
    y: f.y * content.h,
    width: f.w * content.w,
    height: f.h * content.h,
  };
}

/** What fraction of the content box a world rect covers.
 *
 *  A pane measured before layout is 0×0, and dividing by that would seed every
 *  stored position with `NaN` — which compares false against everything and so
 *  fails silently rather than loudly. Zero sides give zeros. */
export function worldToFrac(r: WorldRect, content: { w: number; h: number }): FracRect {
  const sx = content.w === 0 ? 0 : 1 / content.w;
  const sy = content.h === 0 ? 0 : 1 / content.h;
  return { x: r.x * sx, y: r.y * sy, w: r.width * sx, h: r.height * sy };
}

const DP = 10_000;

/** Snap to 4dp. Positions are diffed by humans in stored documents, so the
 *  last digits of a float are noise that hides the change that matters. */
export function roundFrac(f: FracRect): FracRect {
  return {
    x: Math.round(f.x * DP) / DP,
    y: Math.round(f.y * DP) / DP,
    w: Math.round(f.w * DP) / DP,
    h: Math.round(f.h * DP) / DP,
  };
}

/** Whether `pt` falls in `box`, widened by `tol` on every side so a hairline
 *  mark stays reachable. */
export function fracContains(box: FracRect, pt: FracPoint, tol = 0): boolean {
  return (
    pt.x >= box.x - tol &&
    pt.x <= box.x + box.w + tol &&
    pt.y >= box.y - tol &&
    pt.y <= box.y + box.h + tol
  );
}

/** Whether `outer` wholly encloses `inner`. A marquee takes what it encloses,
 *  not what it grazes — brushing selection is a different gesture, and this
 *  answers false for two rects that merely overlap. */
export function fracEncloses(outer: FracRect, inner: FracRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

/** The smallest box holding every point — zero-size for a single one. */
export function boundsOf(points: readonly FracPoint[]): FracRect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Points restated as fractions of `box` itself, so they move and stretch with
 *  it. Unit-agnostic: `points` and `box` only have to share one. A box with no
 *  width or height puts every point on its edge along that axis. */
export function toShape(points: readonly FracPoint[], box: FracRect): FracPoint[] {
  return points.map((p) => ({
    x: box.w === 0 ? 0 : (p.x - box.x) / box.w,
    y: box.h === 0 ? 0 : (p.y - box.y) / box.h,
  }));
}

/** `toShape`'s inverse: a shape placed in `box`, in `box`'s units. */
export function fromShape(shape: readonly FracPoint[], box: FracRect): FracPoint[] {
  return shape.map((s) => ({ x: box.x + s.x * box.w, y: box.y + s.y * box.h }));
}

/** A world rect as the `{ x, y, w, h }` the shape helpers take. */
export const boxOf = (r: WorldRect): FracRect => ({ x: r.x, y: r.y, w: r.width, h: r.height });

const roundPoint = (p: FracPoint): FracPoint => ({
  x: Math.round(p.x * DP) / DP,
  y: Math.round(p.y * DP) / DP,
});

/** `roundFrac` for points. */
export const roundPoints = (pts: readonly FracPoint[]): FracPoint[] => pts.map(roundPoint);
