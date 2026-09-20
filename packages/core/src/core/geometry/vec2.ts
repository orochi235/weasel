/**
 * The kit's 2D point.
 *
 * `@weasel-js/geom` deliberately has no point struct — its 2D tier passes loose
 * components so the f32-relative epsilon policy in `scalar.ts` has nothing
 * between it and the numbers. This is the API layer's counterpart, where a call
 * site reads better than a pair of arguments does.
 */

/** A 2D point or vector. */
export interface Vec2 {
  x: number;
  y: number;
}
