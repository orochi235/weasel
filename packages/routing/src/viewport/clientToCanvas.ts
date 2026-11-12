/** What these conversions read off an element: any `Element` is one, and an `HTMLElement` also reports its layout size. */
export interface ShownElement {
  getBoundingClientRect(): { left: number; top: number; width?: number; height?: number };
  offsetWidth?: number;
  offsetHeight?: number;
}

/** An element's box: client position, and size in its own CSS pixels. */
export interface LayoutBox {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Client pixels per CSS pixel of the element, per axis. */
  scale: { x: number; y: number };
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

/**
 * `el`'s box in its own CSS pixels — the size layout gave it, which an
 * ancestor transform does not change — at its client position.
 */
export function layoutBoxOf(el: ShownElement): LayoutBox {
  const r = el.getBoundingClientRect();
  const scale = clientScaleOf(el, r);
  return { left: r.left, top: r.top, width: (r.width ?? 0) / scale.x, height: (r.height ?? 0) / scale.y, scale };
}

/**
 * Convert client coords to element CSS-pixel coords (relative to the element's
 * top-left), dividing out any scale an ancestor transform shows it at. Apps
 * drawing in CSS-pixel space feed the result directly into world math when
 * pan/zoom is identity. With pan/zoom, compose this with your
 * inverse-viewport transform.
 */
export function clientToCanvas(
  canvas: ShownElement,
  clientX: number,
  clientY: number,
): [number, number] {
  const { left, top, scale } = layoutBoxOf(canvas);
  return [(clientX - left) / scale.x, (clientY - top) / scale.y];
}

/** The inverse of {@link clientToCanvas}: a point in `canvas`'s CSS pixels as client coords. */
export function canvasToClient(
  canvas: ShownElement,
  x: number,
  y: number,
): [number, number] {
  const { left, top, scale } = layoutBoxOf(canvas);
  return [left + x * scale.x, top + y * scale.y];
}

/**
 * Rect-taking variant of `clientToCanvas` for call sites that already hold a
 * `DOMRect` (or any `{ left, top }` object) and don't have a canvas element
 * in scope. It knows nothing of an ancestor transform; pass the element to
 * `clientToCanvas` where there may be one.
 */
export function clientToCanvasRect(
  rect: { left: number; top: number },
  clientX: number,
  clientY: number,
): [number, number] {
  return [clientX - rect.left, clientY - rect.top];
}
