import type { WorldPoint } from '@weasel-js/routing';
import type { MoveOptions } from 'interactions/actions/moveOptions';
import type { ResizeOptions } from 'interactions/actions/resizeOptions';
import type { RotateOptions } from 'interactions/actions/rotateOptions';

/** `<SceneCanvas selectTool>`. `pickBest` configures the internal select tool, and is
 *  ignored under a `tools` takeover; `handleHitRadius` sizes the handles' hit area, and
 *  `move`, `resize` and `rotate` configure their presets, either way. */
export interface SceneCanvasSelectTool<TPose> {
  move?: MoveOptions<TPose>;
  resize?: ResizeOptions<TPose>;
  /** Rotation options, or `false` to hide the rotation handle and bind it to
   *  nothing; the `rotate` action stays, for other tools and `actions.rotate`. */
  rotate?: RotateOptions<TPose> | false;
  handleHitRadius?: number;
  /** Override the body-pick used on click/pointerdown. Alt-aware: receives
   *  the live alt state + current selection so consumers can implement
   *  alt-cycling through an overlapping stack. Default: top-most hit
   *  (alt ignored). */
  pickBest?: (world: WorldPoint, alt: boolean, sel: readonly string[], viewId?: string | null) => string | null;
}
