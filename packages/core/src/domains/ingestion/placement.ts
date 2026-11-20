import type { IngestCtx } from './contentHandlers';
import type { Rect } from '@weasel-js/geom';

const CASCADE_OFFSET_PX = 24;

/**
 * Where the kit's handlers put arriving content of a given size: centered on
 * `ctx.point` (a drop, a pointed ingest) or on the viewport (a paste), with the
 * `index`-th item of one arrival stepped 24 CSS px down and right on screen of
 * the first, at any zoom and on a flipped axis. With no `worldPerPx` a CSS px
 * is a world unit.
 */
export function arrivalBounds(
  ctx: Pick<IngestCtx, 'point' | 'viewportWorldRect' | 'worldPerPx'>,
  size: { width: number; height: number },
  index: number,
): Rect {
  const view = ctx.viewportWorldRect();
  const center = ctx.point ?? { x: view.x + view.width / 2, y: view.y + view.height / 2 };
  const perPx = ctx.worldPerPx?.() ?? { x: 1, y: 1 };
  const steps = index * CASCADE_OFFSET_PX;
  return {
    x: center.x - size.width / 2 + steps * perPx.x,
    y: center.y - size.height / 2 + steps * perPx.y,
    width: size.width,
    height: size.height,
  };
}
