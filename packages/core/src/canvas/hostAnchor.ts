import { clampRectWithin, type PlacementAlign, type Rect } from '@weasel-js/geom';

/** Which of the host's edges the panel is held against, per axis. */
export interface HostAnchorAlign {
  x: PlacementAlign;
  y: PlacementAlign;
}

/** Inset from the anchored corner, in CSS pixels, positive going inward. */
export interface HostAnchorOffset {
  x: number;
  y: number;
}

/** Everything {@link hostAnchorRect} needs, all in viewport coordinates. */
export interface HostAnchorInput {
  host: Rect;
  panel: { width: number; height: number };
  viewport: { width: number; height: number };
  align: HostAnchorAlign;
  offset: HostAnchorOffset;
  /** Minimum gap kept between the panel and the viewport edge. Default 0. */
  padding?: number;
}

function insetAlong(start: number, extent: number, size: number, align: PlacementAlign, by: number): number {
  if (align === 'start') return start + by;
  if (align === 'end') return start + extent - size - by;
  return start + (extent - size) / 2 + by;
}

/**
 * Where a fixed-position panel held against a host element's corner lands, once
 * it has been kept inside the viewport. Returns a rect rather than CSS so the
 * caller decides which edges to pin — see {@link hostAnchorCss}.
 */
export function hostAnchorRect(input: HostAnchorInput): Rect {
  const { host, panel, viewport, align, offset, padding = 0 } = input;
  const desired: Rect = {
    x: insetAlong(host.x, host.width, panel.width, align.x, offset.x),
    y: insetAlong(host.y, host.height, panel.height, align.y, offset.y),
    width: panel.width,
    height: panel.height,
  };
  return clampRectWithin(desired, { x: 0, y: 0, width: viewport.width, height: viewport.height }, padding);
}

/**
 * CSS for a resolved rect, pinning whichever edges the alignment names.
 *
 * Pinning matters beyond taste: a panel whose width tracks its content holds
 * the anchored edge still and grows away from it. Pin the wrong edge and the
 * anchored corner drifts on every content change, correcting only once a
 * resize observer catches up.
 */
export function hostAnchorCss(
  rect: Rect,
  align: HostAnchorAlign,
  viewport: { width: number; height: number },
): { top?: number; right?: number; bottom?: number; left?: number } {
  return {
    ...(align.y === 'end'
      ? { bottom: viewport.height - rect.y - rect.height }
      : { top: rect.y }),
    ...(align.x === 'end'
      ? { right: viewport.width - rect.x - rect.width }
      : { left: rect.x }),
  };
}
