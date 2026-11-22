import { wheelPixels } from '@weasel-js/ui-input';

const SCROLLS = new Set(['auto', 'scroll', 'overlay']);
const HOLDS = new Set(['hidden', 'clip']);

type Axis = 'overflowX' | 'overflowY';

/** The viewport's overflow on `axis`: the root's, or the body's when the root's is `visible`, as CSS propagates it. */
function viewportOverflow(doc: Document, axis: Axis): string {
  const view = doc.defaultView ?? window;
  const root = view.getComputedStyle(doc.documentElement)[axis];
  if (root !== 'visible' || !doc.body) return root;
  return view.getComputedStyle(doc.body)[axis];
}

function canMove(
  el: Element,
  axis: Axis,
  style: CSSStyleDeclaration,
  at: number,
  room: number,
  delta: number,
): boolean {
  if (delta === 0 || room <= 0) return false;
  const doc = el.ownerDocument;
  if (el === doc.scrollingElement) {
    if (HOLDS.has(viewportOverflow(doc, axis))) return false;
  } else if (!SCROLLS.has(style[axis])) return false;
  return delta > 0 ? at < room - 0.5 : at > 0.5;
}

/** The next element out, through a shadow root's host and out of a same-origin frame, as a scroll chains. */
function parentOf(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  // A frame's ShadowRoot is not this realm's, so `instanceof` would miss it.
  if (root !== el.ownerDocument && 'host' in root) return (root as ShadowRoot).host;
  try {
    return el.ownerDocument.defaultView?.frameElement ?? null;
  } catch {
    return null;
  }
}

/**
 * Scrolls the nearest element at or above `from` that a user could scroll in the wheel's direction, as a browser does
 * for a trusted wheel and does not for a dispatched one. Returns whether anything moved.
 */
export function scrollByWheel(from: Element, wheel: WheelEvent): boolean {
  for (let el: Element | null = from; el; el = parentOf(el)) {
    const { x: dx, y: dy } = wheelPixels(wheel, { x: el.clientWidth, y: el.clientHeight });
    const style = (el.ownerDocument.defaultView ?? window).getComputedStyle(el);
    const x = canMove(el, 'overflowX', style, el.scrollLeft, el.scrollWidth - el.clientWidth, dx);
    const y = canMove(el, 'overflowY', style, el.scrollTop, el.scrollHeight - el.clientHeight, dy);
    if (!x && !y) continue;
    el.scrollBy({ left: x ? dx : 0, top: y ? dy : 0 });
    return true;
  }
  return false;
}
