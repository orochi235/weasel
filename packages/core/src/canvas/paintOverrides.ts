/**
 * The paint an animator moves without writing the scene, as one bundle the
 * render walks take: an `Animator` is one.
 */
import type { ColorOverrideRegistry, TrimOverrideRegistry } from '@weasel-js/animator';
import { withColorOverrides } from './colorOverrides';
import type { SceneViewDrawOne } from './NodeShape';
import { withTrimOverrides } from './trimOverrides';

/** Animated paint to lay over a scene's nodes, typically an `animator`. */
export interface PaintOverrides {
  /** Per-anchor colors; see `NodePaintCtx.vertexColors`. */
  colorOverrides?: ColorOverrideRegistry;
  /** Stroke trims; see `NodePaintCtx.trim`. */
  trimOverrides?: TrimOverrideRegistry;
}

/** `drawOne` painting whichever of `overrides` is set. */
export function withPaintOverrides<TData, TLayer extends string, TPose>(
  overrides: PaintOverrides | undefined,
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>,
): SceneViewDrawOne<TData, TLayer, TPose> {
  const colored = overrides?.colorOverrides ? withColorOverrides(overrides.colorOverrides, drawOne) : drawOne;
  return overrides?.trimOverrides ? withTrimOverrides(overrides.trimOverrides, colored) : colored;
}
