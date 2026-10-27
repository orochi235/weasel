import { type RefObject, useContext, useEffect } from 'react';
import { CameraWheelContext } from '../canvas/CameraWheelContext';

/** Pixels per wheel line, for a wheel event that reports in lines. */
const LINE_PX = 40;

function pixelDelta(e: WheelEvent, el: Element): { x: number; y: number } {
  const unit = (page: number) => (e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? page : 1);
  // A mouse without a horizontal wheel sends shift+wheel as vertical; the page scrolls sideways for it.
  const [dx, dy] = e.shiftKey && e.deltaX === 0 ? [e.deltaY, 0] : [e.deltaX, e.deltaY];
  return { x: dx * unit(el.clientWidth), y: dy * unit(el.clientHeight) };
}

function scrolls(el: Element, axis: 'x' | 'y', delta: number): boolean {
  if (delta === 0) return false;
  const overflow = getComputedStyle(el)[axis === 'x' ? 'overflowX' : 'overflowY'];
  if (overflow !== 'auto' && overflow !== 'scroll') return false;
  const at = axis === 'x' ? el.scrollLeft : el.scrollTop;
  const max = axis === 'x' ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
  return delta < 0 ? at > 0 : at < max;
}

/** The deepest element of `el`'s subtree whose box holds the point, by geometry alone: hit testing skips a subtree
 *  with `pointer-events: none`, which a target can wear while it still shows nothing. Later siblings paint on top. */
function deepestAt(el: Element, x: number, y: number): Element {
  const children = Array.from(el.children);
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i]!;
    const r = child.getBoundingClientRect();
    if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return deepestAt(child, x, y);
  }
  return el;
}

/**
 * Scrolls what a wheel over `box` would have scrolled had `box` not been in the way: the nearest element under the
 * pointer, inside `target`, that can scroll that way, then its ancestors. Returns whether anything scrolled.
 */
export function scrollUnder(e: WheelEvent, box: Element, target: Element): boolean {
  const doc = target.ownerDocument;
  const under =
    typeof doc.elementsFromPoint === 'function'
      ? doc.elementsFromPoint(e.clientX, e.clientY).find((el) => el !== box && target.contains(el))
      : undefined;
  for (
    let el: Element | null = under ?? deepestAt(target, e.clientX, e.clientY);
    el;
    el = el.parentElement
  ) {
    const d = pixelDelta(e, el);
    const x = scrolls(el, 'x', d.x);
    const y = scrolls(el, 'y', d.y);
    if (!x && !y) continue;
    if (x) el.scrollLeft += d.x;
    if (y) el.scrollTop += d.y;
    return true;
  }
  return false;
}

/**
 * Hands a wheel over a target's input box on. The box is portalled out of whatever the picture sits in, so a wheel
 * over it reaches neither the trial's camera nor a scroller in the target by itself: it goes to the camera when the
 * trial has one, and otherwise scrolls what is under it.
 */
export function useWheelHandOff(
  input: HTMLElement | null,
  target: RefObject<HTMLElement | null>,
): void {
  const wheelSlot = useContext(CameraWheelContext);
  useEffect(() => {
    if (!input) return;
    const wheel = (e: WheelEvent): void => {
      const camera = wheelSlot?.current;
      if (camera) {
        camera(e);
        return;
      }
      const el = target.current;
      if (el && scrollUnder(e, input, el)) e.preventDefault();
    };
    input.addEventListener('wheel', wheel, { passive: false });
    return () => input.removeEventListener('wheel', wheel);
  }, [input, wheelSlot, target]);
}
