import { clientScaleOf, type ShownElement } from '@weasel-js/gestures';

export { clientScaleOf, type ShownElement };

/** An element's box: client position, and size in its own CSS pixels. */
export interface LayoutBox {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Client pixels per CSS pixel of the element, per axis. */
  scale: { x: number; y: number };
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

/** What {@link scrolledPlaceOf} reads off a scroller: its box, its border, and how far it is scrolled. */
export interface ShownScroller extends ShownElement {
  scrollLeft: number;
  scrollTop: number;
  clientLeft?: number;
  clientTop?: number;
}

/**
 * Where `el` sits in `scroller`'s scrolled content, in the scroller's own CSS px: the `scrollLeft` and `scrollTop`
 * that would put `el`'s top-left corner at the scroller's top-left, inside its border. An ancestor transform drawing
 * both at another size is divided out, as {@link clientToCanvas} divides it.
 */
export function scrolledPlaceOf(el: Pick<ShownElement, 'getBoundingClientRect'>, scroller: ShownScroller): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const [x, y] = clientToCanvas(scroller, r.left, r.top);
  return { x: x - (scroller.clientLeft ?? 0) + scroller.scrollLeft, y: y - (scroller.clientTop ?? 0) + scroller.scrollTop };
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
