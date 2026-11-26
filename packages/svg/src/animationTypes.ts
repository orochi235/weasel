/** What a parse records about the elements its clip animates, for a binder to lower sampled values against. */
import type { Affine } from '@weasel-js/geom';

type Matrix = Affine;

/** A shape element a clip animates, as the document wrote it. */
export interface AnimatedShape {
  /** Its tag, lowercased. */
  tag: string;
  /** Its geometry attributes, lengths in user units: `r`, `cx`, `points`, `d` and the rest its tag takes. */
  geometry: Readonly<Record<string, number | string>>;
  /** The matrix its geometry was lowered through: every transform above it, and its own unless that became a rotation. */
  matrix: Matrix;
}

/** For each paint property a clip animates, the element a node takes it from, and the value it
 *  takes there: what moves the node when that element's `fill`, `stroke` or their opacity moves. */
export type SvgAnimatedFrom = Partial<Record<SvgAnimatedPaint, { id: string; value: number }>>;

/** The paint properties `SvgAnimatedFrom` follows. */
export type SvgAnimatedPaint = 'fill' | 'stroke' | 'fill-opacity' | 'stroke-opacity';

/** An element whose `transform` a clip animates. Its drafts are lowered through `above × own`. */
export interface AnimatedTransform {
  /** Every transform above the element. */
  above: Matrix;
  /** Its own `transform`, as the document wrote it. */
  own: Matrix;
}
