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
  if (el === el.ownerDocument.documentElement) {
    // The root's client size is the viewport's, not its own.
    const style = getComputedStyle(el);
    const right = r.right - (Number.parseFloat(style.borderRightWidth) || 0) * sx;
    return { left, top, right, bottom: r.bottom - (Number.parseFloat(style.borderBottomWidth) || 0) * sy };
  }
  return { left, top, right: left + el.clientWidth * sx, bottom: top + el.clientHeight * sy };
}

/** The viewport in viewport px, inside its scrollbars; null where the document lays nothing out (jsdom). */
function viewportEdges(doc: Document): Edges | null {
  const root = doc.documentElement;
  if (root.clientWidth === 0 && root.clientHeight === 0) return null;
  return { left: 0, top: 0, right: root.clientWidth, bottom: root.clientHeight };
}

/** Whether the `overflow` `a` computes to goes to the viewport rather than `a`'s own box: the root's always does,
 *  and the body's does when the root's is `visible` on both axes and neither contains its paint. */
function overflowToViewport(a: Element, style: CSSStyleDeclaration): boolean {
  const doc = a.ownerDocument;
  if (a === doc.documentElement) return true;
  if (a !== doc.body || containsPaint(style)) return false;
  const root = getComputedStyle(doc.documentElement);
  return !clips(root.overflowX) && !clips(root.overflowY) && !containsPaint(root);
}

const cut = (out: Edges, edges: Edges, x: boolean, y: boolean): void => {
  if (x) {
    out.left = Math.max(out.left, edges.left);
    out.right = Math.min(out.right, edges.right);
  }
  if (y) {
    out.top = Math.max(out.top, edges.top);
    out.bottom = Math.min(out.bottom, edges.bottom);
  }
};

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
 * layer, then cuts to the viewport. An ancestor an
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
    const scrolls = boxed && !overflowToViewport(a, style);
    const x = contained || (scrolls && clips(style.overflowX));
    const y = contained || (scrolls && clips(style.overflowY));
    if (x || y) cut(out, paddingEdges(a), x, y);
    if (inTopLayer(a)) break;
  }
  // The viewport clips whatever the root's overflow computes to: `visible` there is read as `auto`.
  const viewport = viewportEdges(el.ownerDocument);
  if (viewport) cut(out, viewport, true, true);
  return {
    left: out.left,
    top: out.top,
    width: Math.max(0, out.right - out.left),
    height: Math.max(0, out.bottom - out.top),
  };
}
