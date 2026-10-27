import type { Point } from '../instrument/types';
import type { ViewportSize } from './worldSpec';

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

/**
 * How much the pages embedding `win` enlarge it: the scale an ancestor transform shows each frame element at, from
 * `win`'s up to the top-level page. A transform outside a frame's document is invisible to any measurement inside
 * it. 1 at the top level, and above a frame whose parent is another origin's.
 */
export function embedScale(win: Window | null | undefined): number {
  let scale = 1;
  for (let w = win; w; ) {
    let el: Element | null;
    try {
      el = w.frameElement;
    } catch {
      break;
    }
    if (!el) break;
    scale *= scaleOf(el.getBoundingClientRect().width, (el as HTMLElement).offsetWidth);
    w = el.ownerDocument.defaultView;
  }
  return scale;
}

/** `el`'s size in its own layout px, or `null` when it has none. */
export function layoutSize(el: HTMLElement | null | undefined): ViewportSize | null {
  const box = hostBox(el);
  return box && box.width > 0 && box.height > 0 ? { width: box.width, height: box.height } : null;
}

/** `el`'s size as drawn on the page, ancestor transforms included, or `null`
 *  when it has none. */
export function clientSize(el: HTMLElement | null | undefined): ViewportSize | null {
  const r = el?.getBoundingClientRect();
  return r && r.width > 0 && r.height > 0 ? { width: r.width, height: r.height } : null;
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
