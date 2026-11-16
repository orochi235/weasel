import { pathToAnchors, pxReach, type AnchorSet, type PolygonPath, type Scale2 } from '@weasel-js/geom';

/** Screen-pixel radius for "this click landed on an anchor": the `targets.anchorClickPx` kit setting's default. */
export const ANCHOR_CLICK_PX = 10;

/**
 * Flat index of `path`'s anchor nearest `world` within `reachPx` screen
 * pixels at `scale`, else -1. With no scale, one pixel is one world unit;
 * a `path` that is no polygon has no anchor under anything.
 */
export function anchorIndexUnder(
  path: unknown,
  world: { x: number; y: number },
  reachPx: number = ANCHOR_CLICK_PX,
  scale?: Scale2,
): number {
  if (!path || (path as PolygonPath).kind !== 'polygon') return -1;
  const slop = scale ? pxReach(reachPx, scale) : reachPx;
  let best = -1;
  let bestD2 = slop * slop;
  let flat = 0;
  for (const sub of (pathToAnchors(path as PolygonPath) as AnchorSet).anchors) {
    for (const a of sub) {
      const dx = a.x - world.x;
      const dy = a.y - world.y;
      const d2 = dx * dx + dy * dy;
      // `<=` so an exact-slop hit counts; ties go to the earlier anchor.
      if (d2 <= bestD2 && (best === -1 || d2 < bestD2)) {
        bestD2 = d2;
        best = flat;
      }
      flat++;
    }
  }
  return best;
}
