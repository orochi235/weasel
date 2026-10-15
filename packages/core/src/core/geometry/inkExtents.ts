import type { Bounds } from 'core/viewport/fitViewToBounds';
import { localToWorld, targetTransformOf } from './targetFrame';

/** How far a node's ink reaches past its pose box on each side, measured in
 *  the box's own frame: a centered stroke 10 wide reaches 5 on every side. */
export interface InkExtents {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export const NO_INK_EXTENTS: InkExtents = Object.freeze({ left: 0, top: 0, right: 0, bottom: 0 });

export function isNoInkExtents(e: InkExtents): boolean {
  return e.left === 0 && e.top === 0 && e.right === 0 && e.bottom === 0;
}

/** The extents that grow `inner` into `outer`, both in one frame; a side where
 *  `outer` does not reach past `inner` adds nothing. */
export function inkExtentsBetween(inner: Bounds, outer: Bounds): InkExtents {
  return {
    left: Math.max(0, inner.x - outer.x),
    top: Math.max(0, inner.y - outer.y),
    right: Math.max(0, outer.x + outer.width - (inner.x + inner.width)),
    bottom: Math.max(0, outer.y + outer.height - (inner.y + inner.height)),
  };
}

/**
 * `box` grown by `e` in its own frame, still drawn in that frame: the
 * rotation and `transform` ride along. They turn a box about its own center,
 * so a box grown unevenly is moved until its center lands where the frame put
 * that point of the original.
 */
export function outsetBox(box: Bounds, e: InkExtents): Bounds {
  if (isNoInkExtents(e)) return box;
  const grown = {
    ...box,
    x: box.x - e.left,
    y: box.y - e.top,
    width: box.width + e.left + e.right,
    height: box.height + e.top + e.bottom,
  };
  const xf = targetTransformOf(box);
  if (xf.identity || (e.left === e.right && e.top === e.bottom)) return grown;
  const c = localToWorld(xf, grown.x + grown.width / 2, grown.y + grown.height / 2);
  return { ...grown, x: c.x - grown.width / 2, y: c.y - grown.height / 2 };
}

/** `box` with `e` taken back off: the inverse of {@link outsetBox}, frame
 *  included. A box narrower than its extents comes out flipped. */
export function insetBox(box: Bounds, e: InkExtents): Bounds {
  return outsetBox(box, { left: -e.left, top: -e.top, right: -e.right, bottom: -e.bottom });
}
