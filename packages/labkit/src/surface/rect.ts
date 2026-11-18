import type { Rect as GeomRect } from '@weasel-js/geom';

/** A box in CSS pixels, measured from the surface's own top-left corner. */
export type Rect = GeomRect;

/** The subset of `DOMRect` this package reads. Accepting the subset rather than
 *  `DOMRect` is what lets the pure functions be tested without a DOM. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
