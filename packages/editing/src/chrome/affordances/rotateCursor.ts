import type { CursorSpec } from '@weasel-js/cursor';
import type { Scale2 } from '@weasel-js/geom';

/**
 * The `rotate` glyph for a pointer at world point `at` turning something
 * about world point `pivot`, seen through a view of `scale`. The glyph's arc
 * is drawn over the top of its box, so its up points from the pivot to the
 * pointer and the opening faces what is being turned.
 */
export function rotateCursorAt(
  pivot: { x: number; y: number },
  at: { x: number; y: number },
  scale: Scale2,
): CursorSpec {
  return {
    glyph: 'rotate',
    angle: Math.atan2((at.x - pivot.x) * scale.x, -(at.y - pivot.y) * scale.y),
    fallback: 'grab',
  };
}
