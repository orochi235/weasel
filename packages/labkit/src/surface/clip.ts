import type { Box } from './rect';

interface Edges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const clips = (overflow: string): boolean => overflow !== '' && overflow !== 'visible';

/** Whether `style` turns on paint containment, which clips both axes to the padding box as `overflow: clip` does. */
function containsPaint(style: CSSStyleDeclaration): boolean {
  const contain = style.contain.split(/\s+/);
  if (contain.some((v) => v === 'paint' || v === 'content' || v === 'strict')) return true;
  return style.contentVisibility === 'auto' || style.contentVisibility === 'hidden';
}

/** Whether an element displayed as `display` has a box its `overflow` applies to: `contents` has none, and a
 *  non-replaced inline one is never a scroll container. */
const hasClipBox = (display: string): boolean => display !== 'contents' && display !== 'inline';

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

/** The viewport in viewport px, inside its scrollbars. */
function viewportEdges(doc: Document): Edges {
  const root = doc.documentElement;
  return { left: 0, top: 0, right: root.clientWidth, bottom: root.clientHeight };
}

/** Whether the `overflow` `a` computes to clips the viewport rather than `a`'s own box: the root's always does,
 *  and the body's does when the root's is `visible` on both axes, which hands the body's to the viewport. */
function clipsViewport(a: Element): boolean {
  const doc = a.ownerDocument;
  if (a === doc.documentElement) return true;
  if (a !== doc.body) return false;
  const root = getComputedStyle(doc.documentElement);
  return !clips(root.overflowX) && !clips(root.overflowY);
}

/** The edges `a`'s `overflow` cuts to. */
const clipEdges = (a: Element): Edges =>
  clipsViewport(a) ? viewportEdges(a.ownerDocument) : paddingEdges(a);

/** Whether `el` is drawn in the top layer, where no ancestor's overflow reaches. */
function inTopLayer(el: Element): boolean {
  try {
    return el.matches(':popover-open, :modal, :fullscreen');
  } catch {
    // jsdom knows none of the three.
    return false;
  }
}

/** The element `el`'s box is laid out inside: its slot when it is slotted, its shadow host when it heads a shadow
 *  tree, otherwise its parent element. */
function boxParent(el: Element): Element | null {
  if (el.assignedSlot) return el.assignedSlot;
  if (el.parentElement) return el.parentElement;
  const root = el.parentNode;
  return root instanceof ShadowRoot ? root.host : null;
}

/**
 * The part of `box` — `el`'s own, in viewport px — that every ancestor
 * clipping its overflow, or containing its paint, leaves showing. Each axis is cut only by the ancestors
 * that clip that axis. Where nothing is left the box comes back with a zero
 * width or height.
 *
 * Follows ancestors in the flattened tree, through slots and out of shadow roots, up to the first one in the top
 * layer. An ancestor an
 * absolutely or fixed positioned element escapes is still counted.
 */
export function clipToAncestors(el: Element, box: Box): Box {
  const out: Edges = {
    left: box.left,
    top: box.top,
    right: box.left + box.width,
    bottom: box.top + box.height,
  };
  for (let a = inTopLayer(el) ? null : boxParent(el); a; a = boxParent(a)) {
    const style = getComputedStyle(a);
    const boxed = hasClipBox(style.display);
    const contained = boxed && containsPaint(style);
    const x = contained || (boxed && clips(style.overflowX));
    const y = contained || (boxed && clips(style.overflowY));
    const edges = x || y ? clipEdges(a) : null;
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
