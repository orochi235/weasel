import type { Box } from './rect';

interface Edges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const clips = (overflow: string): boolean => overflow !== '' && overflow !== 'visible';

/** An element's padding box in viewport px, which is what its `overflow` cuts
 *  to: inside the border, and inside a scrollbar. */
function paddingEdges(el: Element): Edges {
  const r = el.getBoundingClientRect();
  if (!(el instanceof HTMLElement) || !(el.offsetWidth > 0 && el.offsetHeight > 0)) {
    return { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height };
  }
  // Client metrics are layout px; the rect has every ancestor's transform in it.
  const sx = r.width / el.offsetWidth;
  const sy = r.height / el.offsetHeight;
  const left = r.left + el.clientLeft * sx;
  const top = r.top + el.clientTop * sy;
  return { left, top, right: left + el.clientWidth * sx, bottom: top + el.clientHeight * sy };
}

/** Whether `el` is drawn in the top layer, where no ancestor's overflow reaches. */
function inTopLayer(el: Element): boolean {
  try {
    return el.matches(':popover-open, :modal, :fullscreen');
  } catch {
    // jsdom knows none of the three.
    return false;
  }
}

/**
 * The part of `box` — `el`'s own, in viewport px — that every ancestor
 * clipping its overflow leaves showing. Each axis is cut only by the ancestors
 * that clip that axis. Where nothing is left the box comes back with a zero
 * width or height.
 *
 * Follows DOM ancestors up to the first one in the top layer. An ancestor an
 * absolutely or fixed positioned element escapes is still counted.
 */
export function clipToAncestors(el: Element, box: Box): Box {
  const out: Edges = {
    left: box.left,
    top: box.top,
    right: box.left + box.width,
    bottom: box.top + box.height,
  };
  for (let a = inTopLayer(el) ? null : el.parentElement; a; a = a.parentElement) {
    const style = getComputedStyle(a);
    const x = clips(style.overflowX);
    const y = clips(style.overflowY);
    const edges = x || y ? paddingEdges(a) : null;
    if (edges && x) {
      out.left = Math.max(out.left, edges.left);
      out.right = Math.min(out.right, edges.right);
    }
    if (edges && y) {
      out.top = Math.max(out.top, edges.top);
      out.bottom = Math.min(out.bottom, edges.bottom);
    }
    if (inTopLayer(a)) break;
  }
  return {
    left: out.left,
    top: out.top,
    width: Math.max(0, out.right - out.left),
    height: Math.max(0, out.bottom - out.top),
  };
}
