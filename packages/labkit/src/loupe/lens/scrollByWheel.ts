/** How far one line and one page of a wheel go, in px, for the deltaModes that are not px. */
const LINE_PX = 16;

const SCROLLS = new Set(['auto', 'scroll', 'overlay']);

function canMove(el: Element, overflow: string, at: number, room: number, delta: number): boolean {
  if (delta === 0 || room <= 0) return false;
  if (el !== el.ownerDocument.scrollingElement && !SCROLLS.has(overflow)) return false;
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
    const scale =
      wheel.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? LINE_PX
        : wheel.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? el.clientHeight
          : 1;
    const dx = wheel.deltaX * scale;
    const dy = wheel.deltaY * scale;
    const style = (el.ownerDocument.defaultView ?? window).getComputedStyle(el);
    const x = canMove(el, style.overflowX, el.scrollLeft, el.scrollWidth - el.clientWidth, dx);
    const y = canMove(el, style.overflowY, el.scrollTop, el.scrollHeight - el.clientHeight, dy);
    if (!x && !y) continue;
    el.scrollBy({ left: x ? dx : 0, top: y ? dy : 0 });
    return true;
  }
  return false;
}
