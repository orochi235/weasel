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
 *  not what it grazes — brushing selection is a different gesture. */
export function fracIntersects(outer: FracRect, inner: FracRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}
