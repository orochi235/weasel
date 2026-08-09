import type { View } from '@weasel-js/core';
import type { WidgetBounds } from '../widget';

/**
 * The inner `View` a loupe renders its content through: the outer view's
 * magnification times `factor`, positioned so `target` sits at the center of
 * a viewport the size of `rect`.
 */
export function loupeInnerView(
  target: { x: number; y: number },
  outer: View,
  rect: WidgetBounds,
  factor: number,
): View {
  const scale = { x: outer.scale.x * factor, y: outer.scale.y * factor };
  return {
    x: target.x - rect.w / 2 / scale.x,
    y: target.y - rect.h / 2 / scale.y,
    scale,
  };
}
