import type { Box } from './scalar';
import type { Span } from './span';

/** How near an edge a dragged pointer starts a scroll, in px, unless a caller says otherwise. */
export const EDGE_SCROLL_MARGIN = 48;

/**
 * How hard a pointer at `p` pushes `span` to scroll, from -1 toward `from` to 1 toward `to`: 0 while `p` is
 * `margin` or more inside both ends, rising linearly to full strength at an end and holding it past there, so
 * overshooting does not reverse the scroll. A span narrower than two margins scrolls toward the nearer end.
 */
export function edgePush(span: Span, p: number, margin: number = EDGE_SCROLL_MARGIN): number {
  if (!(margin > 0)) return 0;
  const fromStart = p - span.from;
  const fromEnd = span.to - p;
  const towardStart = fromStart <= fromEnd;
  const distance = towardStart ? fromStart : fromEnd;
  if (distance >= margin) return 0;
  const strength = Math.min(1, 1 - distance / margin);
  return towardStart ? -strength : strength;
}

/** {@link edgePush} on both axes of a scrolling box: multiply by a top speed for how far to scroll. */
export function edgeScroll(
  bounds: Box, point: { x: number; y: number }, margin: number = EDGE_SCROLL_MARGIN,
): { x: number; y: number } {
  return {
    x: edgePush({ from: bounds.x, to: bounds.x + bounds.width }, point.x, margin),
    y: edgePush({ from: bounds.y, to: bounds.y + bounds.height }, point.y, margin),
  };
}
