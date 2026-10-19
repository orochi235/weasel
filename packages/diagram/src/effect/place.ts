import type { Vec2 } from '@weasel-js/core/math';

type Box = { x: number; y: number; width: number; height: number };

/** Space kept between a placed box and its neighbors, and inside the view's edge. */
export const PLACE_GAP = 24;
const STEP = 8;

const clear = (x: number, y: number, size: { width: number; height: number }, boxes: readonly Box[]) =>
  boxes.every((b) => x >= b.x + b.width + PLACE_GAP || x + size.width + PLACE_GAP <= b.x
    || y >= b.y + b.height + PLACE_GAP || y + size.height + PLACE_GAP <= b.y);

/**
 * The top-left for a box `size` big that nothing has placed: the first spot,
 * row by row from the view's top-left, that keeps `PLACE_GAP` from every box
 * and from the view's edge. Where the view has no such spot, or there is no
 * view, it goes right of the rightmost box, level with that box's top.
 */
export function freeSpot(boxes: readonly Box[], size: { width: number; height: number }, view: Box | null): Vec2 {
  if (view !== null) {
    const right = view.x + view.width - PLACE_GAP - size.width;
    const bottom = view.y + view.height - PLACE_GAP - size.height;
    for (let y = view.y + PLACE_GAP; y <= bottom; y += STEP) {
      for (let x = view.x + PLACE_GAP; x <= right; x += STEP) {
        if (clear(x, y, size, boxes)) return { x, y };
      }
    }
  }
  if (boxes.length === 0) return { x: (view?.x ?? 0) + PLACE_GAP, y: (view?.y ?? 0) + PLACE_GAP };
  const last = boxes.reduce((a, b) => (b.x + b.width > a.x + a.width ? b : a));
  return { x: last.x + last.width + PLACE_GAP, y: last.y };
}
