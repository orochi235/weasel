import type { IngestCtx } from './contentHandlers';

const CASCADE_OFFSET_PX = 24;

/**
 * Where the kit's handlers put arriving content of a given size: centered on
 * `ctx.point` (a drop, a pointed ingest) or on the viewport (a paste), with the
 * `index`-th item of one arrival stepped down and right of the first.
 */
export function arrivalBounds(
  ctx: Pick<IngestCtx, 'point' | 'viewportWorldRect'>,
  size: { width: number; height: number },
  index: number,
): { x: number; y: number; width: number; height: number } {
  const view = ctx.viewportWorldRect();
  const center = ctx.point ?? { x: view.x + view.width / 2, y: view.y + view.height / 2 };
  const offset = index * CASCADE_OFFSET_PX;
  return {
    x: center.x - size.width / 2 + offset,
    y: center.y - size.height / 2 + offset,
    width: size.width,
    height: size.height,
  };
}
