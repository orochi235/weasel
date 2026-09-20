/**
 * The kit's 2D point.
 *
 * `@weasel-js/geom` deliberately has no point struct — its 2D tier passes loose
 * components so the f32-relative epsilon policy in `scalar.ts` has nothing
 * between it and the numbers. This is the API layer's counterpart, where a call
 * site reads better than a pair of arguments does.
 */

/** A 2D point or vector. `@weasel-js/routing` declares this shape as `Point2`
 *  for the dispatcher surface; the two names are one type, so a value crosses
 *  between an action's `ctx.world` and a kit geometry call unconverted. */
export type { Point2 as Vec2 } from '@weasel-js/routing';
