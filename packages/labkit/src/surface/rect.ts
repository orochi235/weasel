/** A box in CSS pixels, measured from the surface's own top-left corner. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The subset of `DOMRect` this package reads. Accepting the subset rather than
 *  `DOMRect` is what lets the pure functions be tested without a DOM. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
