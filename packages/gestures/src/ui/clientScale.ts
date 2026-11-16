/** What a client-to-layout conversion reads off an element: any `Element` is one, and an `HTMLElement` also reports its layout size. */
export interface ShownElement {
  getBoundingClientRect(): { left: number; top: number; width?: number; height?: number };
  offsetWidth?: number;
  offsetHeight?: number;
}

// `offsetWidth` is rounded to a whole px, so an unscaled box would otherwise
// read a fractional width as a scale a hair off 1.
function axisScale(client: number, layout: number): number {
  return layout > 0 && Math.abs(client - layout) > 0.5 ? client / layout : 1;
}

/**
 * How much ancestor transforms (a `scale()`, a zoomed stage) enlarge `el` on
 * screen, per axis: its client rect over its own layout box. 1 on an axis
 * whose layout size is unknown, as for an element that is not an
 * `HTMLElement`. A rotated ancestor reads as the scale of its bounding box.
 */
export function clientScaleOf(
  el: ShownElement,
  rect: { width?: number; height?: number } = el.getBoundingClientRect(),
): { x: number; y: number } {
  return { x: axisScale(rect.width ?? 0, el.offsetWidth ?? 0), y: axisScale(rect.height ?? 0, el.offsetHeight ?? 0) };
}
