import type { Path } from '@weasel-js/core/math';

/** An axis-aligned box. This is `PoseDescriptor.getBounds`'s return shape
 *  minus its optional `rotation`, deliberately: an outline is built in the
 *  shape's own unrotated frame, and the caller reads rotation separately
 *  through `getRotation` and applies it to the finished path. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** A named outline: how its shape is built in a node's bounds, and where the
 *  node's rows may sit inside it. */
export interface OutlineDef {
  /** Filled and stroked; also the node's silhouette for picking and clipping. */
  path(bounds: Bounds): Path;
  /** Stroked only, over the fill: a cylinder's front rim, a note's fold. */
  detail?(bounds: Bounds): Path;
  /** The largest box rows can occupy without leaving the shape. Default the bounds. */
  content?(bounds: Bounds): Bounds;
  /** The inverse of `content`: a box whose content is at least `content`. Default the content size. */
  boxForContent?(content: Size): Size;
}
