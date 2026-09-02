import type { View } from '@weasel-js/core';

/** A point on the magnified surface, in its own CSS pixels. */
export interface LoupePoint {
  x: number;
  y: number;
}

/** The lens' rectangle on that surface. */
export interface LoupeRect extends LoupePoint {
  w: number;
  h: number;
}

/**
 * The inner `View` a loupe renders its content through: the outer view's
 * magnification times `factor`, positioned so `target` sits at the center of
 * a viewport the size of `rect`.
 */
export function loupeInnerView(
  target: LoupePoint,
  outer: View,
  rect: LoupeRect,
  factor: number,
): View {
  const scale = { x: outer.scale.x * factor, y: outer.scale.y * factor };
  return {
    x: target.x - rect.w / 2 / scale.x,
    y: target.y - rect.h / 2 / scale.y,
    scale,
  };
}

/**
 * Where on the outer surface a point inside the lens is looking, in
 * screen-space CSS px.
 *
 * The inverse of {@link loupeInnerView}: the lens centers `aim` in `rect` and
 * magnifies by `factor`, and the outer view's own scale cancels out of the
 * round trip — so this needs no `View`.
 */
export function loupeSourcePoint(
  p: LoupePoint,
  rect: LoupeRect,
  aim: LoupePoint,
  factor: number,
): LoupePoint {
  return {
    x: aim.x + (p.x - (rect.x + rect.w / 2)) / factor,
    y: aim.y + (p.y - (rect.y + rect.h / 2)) / factor,
  };
}
