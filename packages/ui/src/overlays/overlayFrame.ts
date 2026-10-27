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
 * In an unscaled container the frame is fixed; in a scaled one it is absolute, since a scale written as `zoom`
 * resizes a fixed descendant without containing it. Either way it is cut to the part of the viewport that no
 * ancestor clipping it hides, which keeps it inside every scrollport above it: a fixed frame acts as an absolute one
 * under a `transform`, `filter` or `contain` ancestor, and a viewport-sized one there would add to the scroll range.
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

interface Region {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The client rect a box positioned in `block` can be seen in: the viewport, cut to the padding box of each element
 * that clips it — `block` and every ancestor up its chain of containing blocks with overflow other than visible on
 * an axis, or paint containment. A frame cut to this lies inside every scrollport above it, so it adds nothing to
 * their scroll range, and an overlay placed against it stays where it can be seen.
 */
function visibleRegion(block: Element): Region {
  const doc = block.ownerDocument;
  const root = doc.documentElement;
  const seen: Region = { left: 0, top: 0, right: root.clientWidth, bottom: root.clientHeight };
  for (let at: Element | null = block; at && at !== root && at !== doc.body; ) {
    const style = getComputedStyle(at);
    const paint = /paint|strict|content/.test(style.contain ?? '');
    const clipX = paint || style.overflowX !== 'visible';
    const clipY = paint || style.overflowY !== 'visible';
    if ((clipX || clipY) && at instanceof HTMLElement && at.offsetWidth > 0 && at.offsetHeight > 0) {
      const rect = realRect(at);
      const sx = rect.width / at.offsetWidth;
      const sy = rect.height / at.offsetHeight;
      if (clipX) {
        const left = rect.left + at.clientLeft * sx;
        seen.left = Math.max(seen.left, left);
        seen.right = Math.min(seen.right, left + at.clientWidth * sx);
      }
      if (clipY) {
        const top = rect.top + at.clientTop * sy;
        seen.top = Math.max(seen.top, top);
        seen.bottom = Math.min(seen.bottom, top + at.clientHeight * sy);
      }
    }
    const parent: Element | null = at.parentElement;
    if (style.position === 'fixed') at = parent && fixedBlockFrom(parent);
    else if (style.position === 'absolute') at = parent && blockForChildOf(parent);
    else at = parent;
  }
  return seen;
}

/** The nearest element from `el` up that is the containing block for fixed descendants, or null for the viewport. */
function fixedBlockFrom(el: Element): Element | null {
  const root = el.ownerDocument.documentElement;
  for (let at: Element | null = el; at && at !== root; at = at.parentElement) {
    if (holdsPositioned(at)) return at;
  }
  return null;
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
  const blockEl = containingBlock(frame);
  const block = blockFrame(blockEl);
  const doc = frame.ownerDocument;
  const root = doc.documentElement;
  const seen = visibleRegion(blockEl);
  // React Aria floors a placement in the frame's px; on a whole px of the block, that lands on the block's own grid.
  const exact = clientToBlock({ x: seen.left, y: seen.top }, block);
  const corner = { x: Math.floor(exact.x), y: Math.floor(exact.y) };
  const size = {
    width: Math.max(0, seen.right - seen.left) / block.scaleX + exact.x - corner.x,
    height: Math.max(0, seen.bottom - seen.top) / block.scaleY + exact.y - corner.y,
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
