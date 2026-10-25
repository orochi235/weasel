/** How far one line and one page of a wheel go, in px, for the deltaModes that are not px. */
const LINE_PX = 16;

const SCROLLS = new Set(['auto', 'scroll', 'overlay']);

function canMove(el: Element, overflow: string, at: number, room: number, delta: number): boolean {
  if (delta === 0 || room <= 0) return false;
  if (el !== document.scrollingElement && !SCROLLS.has(overflow)) return false;
  return delta > 0 ? at < room - 0.5 : at > 0.5;
}

function parentOf(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
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
    const style = getComputedStyle(el);
    const x = canMove(el, style.overflowX, el.scrollLeft, el.scrollWidth - el.clientWidth, dx);
    const y = canMove(el, style.overflowY, el.scrollTop, el.scrollHeight - el.clientHeight, dy);
    if (!x && !y) continue;
    el.scrollBy({ left: x ? dx : 0, top: y ? dy : 0 });
    return true;
  }
  return false;
}
