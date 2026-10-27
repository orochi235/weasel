import { blockFrame, clientToBlock, containingBlock, holdsPositioned, isScaled, realRect } from './blockFrame';
import s from './overlayFrame.module.css';

/*
 * An overlay frame: a box laid over the viewport inside a portal container, which React Aria places an overlay in
 * and against. Placing against the body from inside a positioned container, React Aria shifts an overlay sideways
 * as though the viewport's corner sat at the container's (react-aria 3.52.1); inside a scaled box it also reads the
 * viewport, and the container height a top placement's `bottom` counts from, in client px. As the overlay's
 * containing block and boundary both, the frame answers all of them in its own px: its `getBoundingClientRect`
 * reports its own size, at the corner React Aria's page-offset arithmetic takes for the viewport's.
 *
 * In an unscaled container the frame is fixed, so it adds nothing to the scroll range of a container that scrolls;
 * in a scaled one it is absolute, since a scale written as `zoom` resizes a fixed descendant without containing it.
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
 * The frame an overlay portaled into `container` should be placed in, or null when the overlay's containing block
 * would be the viewport and React Aria's own measurement is right. Created inside the container on first use and
 * kept there.
 */
export function overlayFrameFor(container: Element | null | undefined): HTMLElement | null {
  if (!container || typeof document === 'undefined') return null;
  if (isFrame(container)) return container;
  const doc = container.ownerDocument;
  if (container === doc.documentElement || container === doc.body) return null;
  const block = blockForChildOf(container);
  if (block === doc.documentElement || block === doc.body) return null;
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
  const container = frame.parentElement;
  frame.classList.toggle(s.fixed, !container || !isScaled(blockFrame(blockForChildOf(container))));
  const block = blockFrame(containingBlock(frame));
  const doc = frame.ownerDocument;
  const root = doc.documentElement;
  // React Aria floors a placement in the frame's px; on a whole px of the block, that lands on the block's own grid.
  const exact = clientToBlock({ x: 0, y: 0 }, block);
  const corner = { x: Math.floor(exact.x), y: Math.floor(exact.y) };
  const size = {
    width: root.clientWidth / block.scaleX + exact.x - corner.x,
    height: root.clientHeight / block.scaleY + exact.y - corner.y,
  };
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
