/**
 * The subset of the Lottie format `writeLottie` writes: shape layers of groups holding paths,
 * fills, strokes and trims, with scalar properties that may be keyframed.
 */

/** An `[x, y]` pair. */
export type LottiePoint = [number, number];

/** One keyframe of a scalar property: its value from frame `t`, and how it eases to the next. */
export interface LottieKeyframe {
  t: number;
  s: [number];
  /** Set where the value holds until the next keyframe, then jumps. */
  h?: 1;
  /** The bezier tangents of the span to the next keyframe, as CSS `cubic-bezier` gives them. */
  o?: { x: [number]; y: [number] };
  i?: { x: [number]; y: [number] };
}

/** A property that holds one value throughout. */
export interface LottieStatic<T> { a: 0; k: T }
/** A scalar property: held, or keyframed. */
export type LottieScalar = LottieStatic<number> | { a: 1; k: LottieKeyframe[] };

/** One subpath: its vertices, with each one's in and out tangents relative to it. */
export interface LottieBezier { c: boolean; v: LottiePoint[]; i: LottiePoint[]; o: LottiePoint[] }

/** A transform; the writer bakes geometry in, so only a layer's position moves. */
export interface LottieTransform {
  a: LottieStatic<LottiePoint>;
  p: LottieStatic<LottiePoint>;
  s: LottieStatic<LottiePoint>;
  r: LottieStatic<number>;
  o: LottieScalar;
}

export interface LottiePath { ty: 'sh'; nm?: string; ks: LottieStatic<LottieBezier> }
/** `r` is the fill rule: 1 nonzero, 2 even-odd. Colors are `[r, g, b, a]` in 0..1. */
export interface LottieFill { ty: 'fl'; c: LottieStatic<number[]>; o: LottieScalar; r: 1 | 2 }
/** `lc` is the cap (1 butt, 2 round, 3 square) and `lj` the join (1 miter, 2 round, 3 bevel). */
export interface LottieStroke { ty: 'st'; c: LottieStatic<number[]>; o: LottieScalar; w: LottieScalar; lc: 1 | 2 | 3; lj: 1 | 2 | 3; ml: number }
/** Trim of the paths before it, edges in percent; `m: 1` trims every path as one. */
export interface LottieTrim { ty: 'tm'; s: LottieScalar; e: LottieScalar; o: LottieScalar; m: 1 }
export interface LottieGroupTransform extends LottieTransform { ty: 'tr' }

export type LottieShapeItem = LottiePath | LottieFill | LottieStroke | LottieTrim | LottieGroupTransform;

/** A group of shape items; it ends with its `tr`. */
export interface LottieGroup { ty: 'gr'; nm?: string; it: LottieShapeItem[] }

/** A shape layer, drawn from frame `ip` to `op`. */
export interface LottieShapeLayer {
  ddd: 0;
  ind: number;
  ty: 4;
  nm: string;
  sr: 1;
  ks: LottieTransform;
  ao: 0;
  shapes: LottieGroup[];
  ip: number;
  op: number;
  st: 0;
  bm: 0;
}

/** A Lottie animation: `fr` frames a second, from frame `ip` to `op`, on a `w` by `h` canvas. Its first layer is drawn on top. */
export interface LottieAnimation {
  v: '5.12.0';
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  ddd: 0;
  assets: [];
  layers: LottieShapeLayer[];
}
