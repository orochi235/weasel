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

/** One screen-pixel length as world-space extents, per axis. `scale` is a
 *  view's, so neither axis is zero (see `View`).
 *
 *  With `rotation`, the axes are a frame turned that far from world, and each
 *  extent is how far along it an edge across it must move to move `px` on
 *  screen — which, under non-uniform zoom, is not the extent along the screen
 *  axis nearest to it. */
export function pxExtent(px: number, scale: Scale2, rotation = 0): { x: number; y: number } {
  if (!rotation) {
    return {
      x: px / Math.abs(scale.x),
      y: px / Math.abs(scale.y),
    };
  }
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return {
    x: px * Math.hypot(c / scale.x, s / scale.y),
    y: px * Math.hypot(s / scale.x, c / scale.y),
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

/**
 * A world point pushed `px` screen pixels off an edge, along the edge's normal
 * as it lands on screen. `normal` is the edge's outward normal in world space.
 *
 * Scaling the world normal by the view is not the same thing: under
 * non-uniform zoom the image of a normal is no longer perpendicular to the
 * image of its edge, so chrome placed that way drifts sideways and sits closer
 * than `px`. Returns the point in world coords and the on-screen unit normal.
 */
export function standoff(
  anchor: { x: number; y: number },
  normal: { x: number; y: number },
  px: number,
  scale: Scale2,
): { x: number; y: number; nx: number; ny: number } {
  // The edge's screen normal is S⁻ᵀn, here scaled by det S to stay finite.
  const k = Math.sign(scale.x * scale.y) || 1;
  let nx = normal.x * scale.y * k;
  let ny = normal.y * scale.x * k;
  const l = Math.hypot(nx, ny) || 1;
  nx /= l;
  ny /= l;
  return { x: anchor.x + (nx * px) / scale.x, y: anchor.y + (ny * px) / scale.y, nx, ny };
}

/** The screen angle a frame turned `rotation` from world lands its x axis at.
 *  Equals `rotation` under uniform zoom; non-uniform zoom bends it. */
export function screenAngleOf(rotation: number, scale: Scale2): number {
  return Math.atan2(Math.sin(rotation) * scale.y, Math.cos(rotation) * scale.x);
}
