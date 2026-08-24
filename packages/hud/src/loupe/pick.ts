import type { WidgetBounds } from '../widget';

/**
 * Where on the outer canvas a point inside the lens is looking, in
 * screen-space CSS px.
 *
 * The inverse of {@link loupeInnerView}: the lens centers `aim` in `rect` and
 * magnifies by `factor`, and the outer view's own scale cancels out of the
 * round trip — so this needs no `View`.
 */
export function loupeSourcePoint(
  p: { x: number; y: number },
  rect: WidgetBounds,
  aim: { x: number; y: number },
  factor: number,
): { x: number; y: number } {
  return {
    x: aim.x + (p.x - (rect.x + rect.w / 2)) / factor,
    y: aim.y + (p.y - (rect.y + rect.h / 2)) / factor,
  };
}
