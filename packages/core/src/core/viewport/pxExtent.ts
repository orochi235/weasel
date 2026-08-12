/**
 * Screen-pixel lengths in world units, per axis.
 *
 * Chrome declares its hit zones in screen pixels — an 8px handle stays 8px at
 * every zoom, because it paints in screen space. Converting one such length to
 * world units with a single scalar (see `meanScale`) is exact only under
 * uniform zoom; per-axis it is too generous on one axis and too mean on the
 * other, so the pickable region stops matching the painted one.
 *
 * Prefer {@link withinPxBox} / {@link withinPxRadius}, which compare in screen
 * space and so can't drift from the paint at all. {@link pxExtent} is for the
 * cases that must stay in world units — a tolerance handed to geometry that
 * doesn't know about the view.
 */

export interface Scale2 {
  x: number;
  y: number;
}

/** Guard against a degenerate axis: a zero scale would send the extent to
 *  infinity and make every point a hit. */
const MIN_SCALE = 1e-9;

/** One screen-pixel length as world-space extents, per axis. */
export function pxExtent(px: number, scale: Scale2): { x: number; y: number } {
  return {
    x: px / Math.max(MIN_SCALE, Math.abs(scale.x)),
    y: px / Math.max(MIN_SCALE, Math.abs(scale.y)),
  };
}

/** World delta → screen delta. Only the scale participates: translation
 *  cancels in a difference, and the kit's views carry no skew. */
export function scaleDelta(dx: number, dy: number, scale: Scale2): { x: number; y: number } {
  return { x: dx * scale.x, y: dy * scale.y };
}

/**
 * Is a world-space delta inside a screen-space square of half-extent `px`?
 *
 * The square is axis-aligned **on screen**, which is what a handle painted in
 * screen space actually is — so this stays true under non-uniform zoom and
 * under a rotated target, where an axis-aligned world-space test is a rotated
 * rectangle on screen.
 */
export function withinPxBox(dx: number, dy: number, px: number, scale: Scale2): boolean {
  const s = scaleDelta(dx, dy, scale);
  return Math.abs(s.x) <= px && Math.abs(s.y) <= px;
}

/** Is a world-space delta inside a screen-space circle of radius `px`? */
export function withinPxRadius(dx: number, dy: number, px: number, scale: Scale2): boolean {
  const s = scaleDelta(dx, dy, scale);
  return s.x * s.x + s.y * s.y <= px * px;
}
