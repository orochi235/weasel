import type { Point } from '../instrument/types';

/**
 * Where an element sits on the page, and how much an ancestor transform — a
 * `<Stage>`, a lens — scales it: `left`/`top` in client px, `width`/`height`
 * in its own layout px, which is what a canvas stack draws in.
 */
export interface HostBox {
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}

// `offsetWidth` is rounded to a whole px, so an unscaled box would otherwise
// read a fractional width as a scale a hair off 1.
function scaleOf(client: number, layout: number): number {
  return layout > 0 && Math.abs(client - layout) > 0.5 ? client / layout : 1;
}

/** `el`'s box, or `null` when there is no element. */
export function hostBox(el: HTMLElement | null | undefined): HostBox | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const scaleX = scaleOf(r.width, el.offsetWidth);
  const scaleY = scaleOf(r.height, el.offsetHeight);
  return {
    left: r.left,
    top: r.top,
    width: r.width / scaleX,
    height: r.height / scaleY,
    scaleX,
    scaleY,
  };
}

/** A client point as layout px from the box's top-left. */
export function clientToHost(box: HostBox | null, cx: number, cy: number): Point {
  if (!box) return { x: cx, y: cy };
  return { x: (cx - box.left) / box.scaleX, y: (cy - box.top) / box.scaleY };
}

/** Layout px from the box's top-left as a client point. */
export function hostToClient(box: HostBox, x: number, y: number): Point {
  return { x: box.left + x * box.scaleX, y: box.top + y * box.scaleY };
}
