import type { Rect } from './box';

/** Which side of the anchor the overlay sits on. */
export type PlacementSide = 'top' | 'bottom' | 'left' | 'right';

/** How the overlay lines up along the side it sits on. */
export type PlacementAlign = 'start' | 'center' | 'end';

/** A side paired with an alignment along it. */
export interface Placement {
  side: PlacementSide;
  align: PlacementAlign;
}

/** Inputs to {@link placeRect}. All rects share one coordinate space. */
export interface PlaceRectOptions {
  anchor: Rect;
  overlay: { width: number; height: number };
  boundary: Rect;
  placement: Placement;
  /** Gap between anchor and overlay along the side axis. Default 0. */
  offset?: number;
  /** Shift along the alignment axis. Default 0. */
  crossOffset?: number;
  /** Minimum gap kept between the overlay and the boundary. Default 0. */
  padding?: number;
  /** Whether to try the opposite side when the preferred one lacks room. Default true. */
  flip?: boolean;
}

/** Where the overlay landed, and the placement that produced it. */
export interface PlacedRect {
  rect: Rect;
  placement: Placement;
}

function alignAlong(start: number, extent: number, size: number, align: PlacementAlign): number {
  if (align === 'start') return start;
  if (align === 'end') return start + extent - size;
  return start + (extent - size) / 2;
}

function positionOn(
  anchor: Rect,
  overlay: { width: number; height: number },
  placement: Placement,
  offset: number,
  crossOffset: number,
): Rect {
  const { width, height } = overlay;
  const { side, align } = placement;
  if (side === 'top' || side === 'bottom') {
    const y = side === 'bottom' ? anchor.y + anchor.height + offset : anchor.y - offset - height;
    return { x: alignAlong(anchor.x, anchor.width, width, align) + crossOffset, y, width, height };
  }
  const x = side === 'right' ? anchor.x + anchor.width + offset : anchor.x - offset - width;
  return { x, y: alignAlong(anchor.y, anchor.height, height, align) + crossOffset, width, height };
}

function clampAxis(start: number, size: number, low: number, extent: number, padding: number): number {
  const min = low + padding;
  return Math.max(min, Math.min(start, min + extent - padding * 2 - size));
}

/**
 * Move `rect` the shortest distance that puts it inside `boundary`, keeping its
 * size. A rect too big to fit pins to the boundary's leading edge.
 */
export function clampRectWithin(rect: Rect, boundary: Rect, padding = 0): Rect {
  return {
    ...rect,
    x: clampAxis(rect.x, rect.width, boundary.x, boundary.width, padding),
    y: clampAxis(rect.y, rect.height, boundary.y, boundary.height, padding),
  };
}

/** Slide along the alignment axis until the overlay is inside. An overlay too
 *  big to fit pins to the boundary's leading edge, because the low clamp runs last. */
function shiftAcross(rect: Rect, boundary: Rect, side: PlacementSide, padding: number): Rect {
  const vertical = side === 'top' || side === 'bottom';
  const size = vertical ? rect.width : rect.height;
  const low = (vertical ? boundary.x : boundary.y) + padding;
  const high = low + (vertical ? boundary.width : boundary.height) - padding * 2 - size;
  const placed = Math.max(low, Math.min(vertical ? rect.x : rect.y, high));
  return vertical ? { ...rect, x: placed } : { ...rect, y: placed };
}

const OPPOSITE: Record<PlacementSide, PlacementSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

function fitsAlongSide(rect: Rect, boundary: Rect, side: PlacementSide, padding: number): boolean {
  const vertical = side === 'top' || side === 'bottom';
  const start = vertical ? rect.y : rect.x;
  const end = start + (vertical ? rect.height : rect.width);
  const low = (vertical ? boundary.y : boundary.x) + padding;
  const high = low + (vertical ? boundary.height : boundary.width) - padding * 2;
  return start >= low && end <= high;
}

export function placeRect(options: PlaceRectOptions): PlacedRect {
  const { anchor, overlay, boundary, placement, offset = 0, crossOffset = 0 } = options;
  const { padding = 0, flip = true } = options;

  let resolved = placement;
  let rect = positionOn(anchor, overlay, resolved, offset, crossOffset);

  if (flip && !fitsAlongSide(rect, boundary, resolved.side, padding)) {
    const opposite = { side: OPPOSITE[resolved.side], align: resolved.align };
    const flipped = positionOn(anchor, overlay, opposite, offset, crossOffset);
    if (fitsAlongSide(flipped, boundary, opposite.side, padding)) {
      resolved = opposite;
      rect = flipped;
    }
  }

  return { rect: shiftAcross(rect, boundary, resolved.side, padding), placement: resolved };
}
