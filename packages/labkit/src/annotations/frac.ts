import {
  type Box,
  boundsOfCoords,
  boxContainsBox,
  boxContainsPoint,
  type Rect,
} from '@weasel-js/geom';
import type { FracPoint, FracRect } from './types';

/** A mark's box in its target's world: CSS pixels at zoom 1. Matches weasel's
 *  default `RectPose`, which is what the scene stores. */
export type WorldRect = Rect;

const boxOfFrac = (f: FracRect): Box => [f.x, f.y, f.x + f.width, f.y + f.height];

/** `n` as a share of `side`. A side too short to divide by, 0 or so small the share overflows, gives 0. */
function share(n: number, side: number): number {
  const q = side === 0 ? 0 : n / side;
  return Number.isFinite(q) ? q : 0;
}

/** Where a fraction lands on a content box of this size. */
export function fracToWorld(f: FracRect, content: { width: number; height: number }): WorldRect {
  return {
    x: f.x * content.width,
    y: f.y * content.height,
    width: f.width * content.width,
    height: f.height * content.height,
  };
}

/** What fraction of the content box a world rect covers.
 *
 *  A pane measured before layout is 0×0, and dividing by that would seed every
 *  stored position with `NaN` — which compares false against everything and so
 *  fails silently rather than loudly. Zero sides give zeros. */
export function worldToFrac(r: WorldRect, content: { width: number; height: number }): FracRect {
  return {
    x: share(r.x, content.width),
    y: share(r.y, content.height),
    width: share(r.width, content.width),
    height: share(r.height, content.height),
  };
}

const DP = 10_000;

/** Snap to 4dp. Positions are diffed by humans in stored documents, so the
 *  last digits of a float are noise that hides the change that matters. */
export function roundFrac(f: FracRect): FracRect {
  return {
    x: Math.round(f.x * DP) / DP,
    y: Math.round(f.y * DP) / DP,
    width: Math.round(f.width * DP) / DP,
    height: Math.round(f.height * DP) / DP,
  };
}

/** Whether `pt` falls in `box`, widened by `tol` on every side so a hairline
 *  mark stays reachable. */
export function fracContains(box: FracRect, pt: FracPoint, tol = 0): boolean {
  const [x0, y0, x1, y1] = boxOfFrac(box);
  return boxContainsPoint([x0 - tol, y0 - tol, x1 + tol, y1 + tol], pt.x, pt.y);
}

/** Whether `outer` wholly encloses `inner`. A marquee takes what it encloses,
 *  not what it grazes — brushing selection is a different gesture, and this
 *  answers false for two rects that merely overlap. */
export function fracEncloses(outer: FracRect, inner: FracRect): boolean {
  return boxContainsBox(boxOfFrac(outer), boxOfFrac(inner));
}

/** The smallest box holding every point — zero-size for a single one, and
 *  `null` for none. */
export function boundsOf(points: readonly FracPoint[]): FracRect | null {
  const b = boundsOfCoords(points.flatMap((p) => [p.x, p.y]));
  return b && { x: b[0], y: b[1], width: b[2] - b[0], height: b[3] - b[1] };
}

/** Points restated as fractions of `box` itself, so they move and stretch with
 *  it. Unit-agnostic: `points` and `box` only have to share one. A box with no
 *  width or height puts every point on its edge along that axis. */
export function toShape(points: readonly FracPoint[], box: FracRect): FracPoint[] {
  return points.map((p) => ({
    x: share(p.x - box.x, box.width),
    y: share(p.y - box.y, box.height),
  }));
}

/** `toShape`'s inverse: a shape placed in `box`, in `box`'s units. */
export function fromShape(shape: readonly FracPoint[], box: FracRect): FracPoint[] {
  return shape.map((s) => ({ x: box.x + s.x * box.width, y: box.y + s.y * box.height }));
}

const roundPoint = (p: FracPoint): FracPoint => ({
  x: Math.round(p.x * DP) / DP,
  y: Math.round(p.y * DP) / DP,
});

/** `roundFrac` for points. */
export const roundPoints = (pts: readonly FracPoint[]): FracPoint[] => pts.map(roundPoint);
