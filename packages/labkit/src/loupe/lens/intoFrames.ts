/** An element a point lands on, and the point in the client coordinates of that element's own document. */
export interface FramePoint {
  el: Element;
  x: number;
  y: number;
}

function isFrame(el: Element): el is HTMLIFrameElement {
  return el.localName === 'iframe' || el.localName === 'frame';
}

/**
 * Follows a point that landed on a frame into the frame's document, and on through any frame there, as a browser's
 * own hit test does for real input. A document's `elementFromPoint` answers with the frame element and stops. It
 * stops at a cross-origin frame, whose document it cannot read, and at a point outside a frame's viewport, which
 * the frame's `elementFromPoint` answers with null.
 */
export function intoFrames(el: Element, x: number, y: number): FramePoint {
  let at: FramePoint = { el, x, y };
  while (isFrame(at.el)) {
    const frame = at.el;
    const doc = frame.contentDocument;
    if (!doc) break;
    const box = frame.getBoundingClientRect();
    const scale = frame.offsetWidth > 0 ? box.width / frame.offsetWidth : 1;
    const style = (frame.ownerDocument.defaultView ?? window).getComputedStyle(frame);
    const left = box.left + (frame.clientLeft + parseFloat(style.paddingLeft)) * scale;
    const top = box.top + (frame.clientTop + parseFloat(style.paddingTop)) * scale;
    const x = (at.x - left) / scale;
    const y = (at.y - top) / scale;
    const inner = doc.elementFromPoint(x, y);
    if (!inner) break;
    at = { el: inner, x, y };
  }
  return at;
}
