/**
 * Pointer forgiveness measured on screen.
 *
 * A pick slop is a screen distance: "within 4px of the outline". Converting it
 * to a world distance — per axis or as one scalar — is exact only when the
 * frame the geometry lives in reaches the screen by a similarity. A rotated
 * node under non-uniform zoom does not: a screen circle pulled back into its
 * frame is a tilted ellipse, so the test is run against the geometry's screen
 * image instead (`strokeHitTest`'s `slop`).
 */
import { multiply, rotate, scale as scaleMat, type Mat3 } from '@weasel-js/geom';
import type { Scale2 } from './pxExtent';

/** `px` screen pixels under a view whose per-axis scale is `scale`. */
export interface ScreenSlop {
  px: number;
  scale: Scale2;
}

/** A slop in world units (a number, the view-less form) or on screen. */
export type PickSlop = number | ScreenSlop;

/**
 * How `strokeHitTest` should apply a slop to geometry in a frame turned by
 * `rotation` from world: a world slop adds to the threshold, a screen slop is
 * handed over with the frame's map to the screen.
 */
export function slopForStrokeHit(
  slop: PickSlop | undefined,
  rotation = 0,
): { extra: number; opts: { slop?: { px: number; transform: Mat3 } } } {
  if (slop === undefined) return { extra: 0, opts: {} };
  if (typeof slop === 'number') return { extra: slop, opts: {} };
  const s = scaleMat(slop.scale.x, slop.scale.y);
  return {
    extra: 0,
    opts: { slop: { px: slop.px, transform: rotation ? multiply(s, rotate(rotation)) : s } },
  };
}

/** `slop` widened by `px` screen pixels — kept on screen when it is measured
 *  there, and read at `scale` when it is a world distance. */
export function widenSlop(slop: PickSlop | undefined, px: number, scale = 1): PickSlop | undefined {
  if (!(px > 0)) return slop;
  if (typeof slop === 'object') return { ...slop, px: slop.px + px };
  return (slop ?? 0) + px / (scale > 0 ? scale : 1);
}

/** Is any slop set at all? A zero reach plus a zero slop hits nothing. */
export function hasSlop(slop: PickSlop | undefined): boolean {
  if (slop === undefined) return false;
  return typeof slop === 'number' ? slop > 0 : slop.px > 0;
}
