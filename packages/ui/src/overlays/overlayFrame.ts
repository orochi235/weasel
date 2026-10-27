import { blockFrame, clientToBlock, containingBlock, holdsPositioned, isScaled, realRect } from './blockFrame';
import s from './overlayFrame.module.css';

/*
 * An overlay frame: a box laid over the viewport inside a scaled box, which React Aria places an overlay in and
 * against. Handed only the trigger in the box's px, React Aria still reads the viewport it flips and limits height
 * against, and the container height a top placement's `bottom` counts from, in client px. As the overlay's
 * containing block and boundary both, the frame answers all of them in its own px: its `getBoundingClientRect`
 * reports its own size, at the corner React Aria's page-offset arithmetic takes for the viewport's.
 */
const FRAMES = new WeakMap<Element, HTMLElement>();
const SIZES = new WeakMap<HTMLElement, { width: number; height: number }>();

const isFrame = (el: Element): el is HTMLElement => el instanceof HTMLElement && SIZES.has(el);

/** The containing block an absolutely positioned child of `el` would have. */
function blockForChildOf(el: Element): Element {
  const root = el.ownerDocument.documentElement;
  for (let at: Element | null = el; at && at !== root; at = at.parentElement) {
    if (getComputedStyle(at).position !== 'static' || holdsPositioned(at)) return at;
  }
  return root;
}

function createFrame(doc: Document): HTMLElement {
  const frame = doc.createElement('div');
  frame.className = s.frame;
  frame.dataset.weaselOverlayFrame = '';
  SIZES.set(frame, { width: 0, height: 0 });
  Object.defineProperty(frame, 'getBoundingClientRect', {
    configurable: true,
    value: () => {
      const { width, height } = SIZES.get(frame)!;
      const root = doc.documentElement;
      return new DOMRect(root.clientLeft - root.scrollLeft, root.clientTop - root.scrollTop, width, height);
    },
  });
  return frame;
}

/**
 * The frame an overlay portaled into `container` should be placed in, or null when the container is drawn at its
 * own size and React Aria's own measurement is right. Created inside the container on first use and kept there.
 */
export function overlayFrameFor(container: Element | null | undefined): HTMLElement | null {
  if (!container || typeof document === 'undefined') return null;
  if (isFrame(container)) return container;
  const doc = container.ownerDocument;
  if (container === doc.documentElement || container === doc.body) return null;
  if (!isScaled(blockFrame(blockForChildOf(container)))) return null;
  let frame = FRAMES.get(container);
  if (!frame) {
    frame = createFrame(doc);
    FRAMES.set(container, frame);
  }
  if (frame.parentElement !== container) container.appendChild(frame);
  return frame;
}

/**
 * Lays `frame` over the viewport and returns a trigger's client rect in the frame's px, written as React Aria's
 * placement reads a target: it adds the page's scroll to a target that is not fixed, and not to one that is.
 * Called as React Aria's `getTargetRect`, which it reads just before every placement, so the frame is laid out
 * from the geometry that placement sees.
 */
export function targetInFrame(rect: DOMRectReadOnly, target: Element, frame: HTMLElement): DOMRect {
  const block = blockFrame(containingBlock(frame));
  const doc = frame.ownerDocument;
  const root = doc.documentElement;
  const corner = clientToBlock({ x: 0, y: 0 }, block);
  const size = { width: root.clientWidth / block.scaleX, height: root.clientHeight / block.scaleY };
  frame.style.left = `${corner.x}px`;
  frame.style.top = `${corner.y}px`;
  frame.style.width = `${size.width}px`;
  frame.style.height = `${size.height}px`;
  SIZES.set(frame, size);
  const at = realRect(frame);
  const fixed = getComputedStyle(target).position === 'fixed';
  const shiftX = fixed ? 0 : root.clientLeft - root.scrollLeft;
  const shiftY = fixed ? 0 : root.clientTop - root.scrollTop;
  return new DOMRect(
    (rect.left - at.left) / block.scaleX + shiftX,
    (rect.top - at.top) / block.scaleY + shiftY,
    rect.width / block.scaleX,
    rect.height / block.scaleY,
  );
}
