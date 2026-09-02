import { clampRectWithin, type Rect } from '@weasel-js/geom';

/** Inset from the host's top-right corner, in CSS pixels. */
export interface HostAnchorOffset {
  top: number;
  right: number;
}

/** Everything {@link hostAnchorStyle} needs, all in viewport coordinates. */
export interface HostAnchorInput {
  host: Rect;
  panel: { width: number; height: number };
  viewport: { width: number; height: number };
  offset: HostAnchorOffset;
  /** Minimum gap kept between the panel and the viewport edge. Default 0. */
  padding?: number;
}

/**
 * Pin a fixed-position panel to a host element's top-right corner, kept inside
 * the viewport. Returns CSS `top`/`right`, so callers style the same two
 * properties whether or not the panel had to be pulled back on screen.
 */
export function hostAnchorStyle(input: HostAnchorInput): { top: number; right: number } {
  const { host, panel, viewport, offset, padding = 0 } = input;
  const desired: Rect = {
    // `right` is a distance from the viewport's right edge; the solver works in
    // left-origin coordinates, so convert going in and coming back out.
    x: host.x + host.width - offset.right - panel.width,
    y: host.y + offset.top,
    width: panel.width,
    height: panel.height,
  };
  const bounds: Rect = { x: 0, y: 0, width: viewport.width, height: viewport.height };
  const placed = clampRectWithin(desired, bounds, padding);
  return { top: placed.y, right: viewport.width - placed.x - panel.width };
}
