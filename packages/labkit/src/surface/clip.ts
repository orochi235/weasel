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
  return style.contentVisibility === 'auto';
}

/** Whether an element displayed as `display` has a box its `overflow` applies to: `contents` has none, and a
 *  non-replaced inline one is never a scroll container. */
const hasClipBox = (display: string): boolean => display !== 'contents' && display !== 'inline';

const px = (v: string): number => Number.parseFloat(v) || 0;

/** How many viewport px one of `el`'s layout px is on each axis: its rect has every ancestor's transform in it. */
function scaleOf(el: Element, r: DOMRect): { sx: number; sy: number } | null {
  if (!(el instanceof HTMLElement) || !(el.offsetWidth > 0 && el.offsetHeight > 0)) return null;
  return { sx: r.width / el.offsetWidth, sy: r.height / el.offsetHeight };
}

/** An element's padding box in viewport px, which is what its `overflow` cuts
 *  to: inside the border, and inside a scrollbar. */
function paddingEdges(el: Element): Edges {
  const r = el.getBoundingClientRect();
  const scale = scaleOf(el, r);
  if (!scale || !(el instanceof HTMLElement)) {
    return { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height };
  }
  const { sx, sy } = scale;
  const left = r.left + el.clientLeft * sx;
  const top = r.top + el.clientTop * sy;
  if (el === el.ownerDocument.documentElement) {
    // The root's client size is the viewport's, not its own.
    const style = getComputedStyle(el);
    const right = r.right - px(style.borderRightWidth) * sx;
    return { left, top, right, bottom: r.bottom - px(style.borderBottomWidth) * sy };
  }
  return { left, top, right: left + el.clientWidth * sx, bottom: top + el.clientHeight * sy };
}

/** The overflow clip edge `overflow: clip` and paint containment cut to: `overflow-clip-margin`'s box, padding by
 *  default, grown by its length. */
function clipMarginEdges(el: Element, style: CSSStyleDeclaration): Edges {
  const tokens = style.overflowClipMargin.split(/\s+/).filter(Boolean);
  const visualBox = tokens.find((t) => t.endsWith('-box')) ?? 'padding-box';
  const margin = px(tokens.find((t) => !t.endsWith('-box')) ?? '0');
  const r = el.getBoundingClientRect();
  const { sx, sy } = scaleOf(el, r) ?? { sx: 1, sy: 1 };
  let e: Edges;
  if (visualBox === 'border-box') {
    e = { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height };
  } else {
    e = paddingEdges(el);
    if (visualBox === 'content-box') {
      e.left += px(style.paddingLeft) * sx;
      e.top += px(style.paddingTop) * sy;
      e.right -= px(style.paddingRight) * sx;
      e.bottom -= px(style.paddingBottom) * sy;
    }
  }
  if (margin === 0) return e;
  return {
    left: e.left - margin * sx,
    top: e.top - margin * sy,
    right: e.right + margin * sx,
    bottom: e.bottom + margin * sy,
  };
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
 * clipping its overflow, or containing its paint, leaves showing; nothing under `content-visibility: hidden`.
 * Each axis is cut only by the ancestors that clip that axis. Where nothing is left the box comes back with a zero
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
    if (boxed && style.contentVisibility === 'hidden') {
      return { left: out.left, top: out.top, width: 0, height: 0 };
    }
    const contained = boxed && containsPaint(style);
    const own = boxed && !overflowToViewport(a, style);
    // A scroll container cuts to its padding box; `overflow: clip` and paint containment to the clip edge.
    const scrollX = own && clips(style.overflowX) && style.overflowX !== 'clip';
    const scrollY = own && clips(style.overflowY) && style.overflowY !== 'clip';
    const clipX = !scrollX && (contained || (own && style.overflowX === 'clip'));
    const clipY = !scrollY && (contained || (own && style.overflowY === 'clip'));
    if (scrollX || scrollY) cut(out, paddingEdges(a), scrollX, scrollY);
    if (clipX || clipY) cut(out, clipMarginEdges(a, style), clipX, clipY);
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
