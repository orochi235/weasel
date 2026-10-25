/**
 * Where an absolutely or fixed positioned element's own px land on screen.
 *
 * An overlay's `top` and `left` are px of its containing block, while every measurement a placement starts from —
 * a trigger's `getBoundingClientRect`, a pointer's `clientX` — is client px. The two agree until an ancestor of the
 * block is drawn at another size, by `transform: scale()` or `zoom`, as a magnifier draws its copy: then a client
 * offset written as a `top` lands that many times too far from the block's corner.
 */
export interface BlockFrame {
  /** The client position of the block's border-box corner. */
  readonly left: number;
  readonly top: number;
  /** Client px per px of the block, on each axis. 1 and 1 when nothing above the block resizes it. */
  readonly scaleX: number;
  readonly scaleY: number;
  /** The block's border and scroll offset, in its own px: what lies between its corner and where `top: 0` sits. */
  readonly insetLeft: number;
  readonly insetTop: number;
}

const UNSCALED: BlockFrame = { left: 0, top: 0, scaleX: 1, scaleY: 1, insetLeft: 0, insetTop: 0 };

/** True when `el` is the containing block for absolutely positioned descendants by its own style alone. */
function holdsPositioned(el: Element): boolean {
  const style = getComputedStyle(el);
  const set = (value: string | undefined) => Boolean(value) && value !== 'none';
  return (
    set(style.transform) ||
    set(style.scale) ||
    set(style.translate) ||
    set(style.rotate) ||
    set(style.perspective) ||
    set(style.filter) ||
    set(style.backdropFilter) ||
    /transform|perspective|scale|translate|rotate|filter/.test(style.willChange ?? '') ||
    /paint|layout|strict|content/.test(style.contain ?? '')
  );
}

/**
 * The containing block an absolutely or fixed positioned `el` is placed in, by the same reading React Aria's
 * placement makes: the offset parent, or for a fixed element the nearest ancestor that holds positioned
 * descendants. The root element stands for the viewport.
 */
export function containingBlock(el: HTMLElement): Element {
  const root = el.ownerDocument.documentElement;
  const parent = el.offsetParent;
  if (parent) {
    const body = el.ownerDocument.body;
    if (parent === body && getComputedStyle(body).position === 'static' && !holdsPositioned(body)) return root;
    return parent;
  }
  for (let at = el.parentElement; at && at !== root; at = at.parentElement) {
    if (holdsPositioned(at)) return at;
  }
  return root;
}

/** How `block`'s own px map to client px. The root element, standing for the viewport, maps one to one. */
export function blockFrame(block: Element): BlockFrame {
  if (block === block.ownerDocument.documentElement || !(block instanceof HTMLElement)) return UNSCALED;
  const rect = block.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    scaleX: scaleOf(rect.width, block.offsetWidth),
    scaleY: scaleOf(rect.height, block.offsetHeight),
    insetLeft: block.clientLeft - block.scrollLeft,
    insetTop: block.clientTop - block.scrollTop,
  };
}

// offsetWidth is rounded to a whole px, so an unscaled box 300.4px wide reads as drawn at 0.9987.
function scaleOf(drawn: number, own: number): number {
  return own > 0 && Math.abs(drawn - own) >= 1 ? drawn / own : 1;
}

export const isScaled = (frame: BlockFrame): boolean => frame.scaleX !== 1 || frame.scaleY !== 1;

/** A client point as the `left` and `top` that put a positioned child of the frame's block on it. */
export function clientToBlock(point: { x: number; y: number }, frame: BlockFrame): { x: number; y: number } {
  return {
    x: (point.x - frame.left) / frame.scaleX - frame.insetLeft,
    y: (point.y - frame.top) / frame.scaleY - frame.insetTop,
  };
}

/**
 * A client rect, shrunk about the block's corner into the block's own px but still written as client
 * coordinates: so that subtracting the block's client corner from it, as React Aria's placement does, gives the
 * rect's offset from that corner in the block's px.
 */
export function inBlockUnits(rect: DOMRectReadOnly, frame: BlockFrame): DOMRect {
  if (!isScaled(frame)) return DOMRect.fromRect(rect);
  return new DOMRect(
    frame.left + (rect.left - frame.left) / frame.scaleX,
    frame.top + (rect.top - frame.top) / frame.scaleY,
    rect.width / frame.scaleX,
    rect.height / frame.scaleY,
  );
}

/**
 * A trigger's client rect as React Aria's placement must be handed it to put `overlay` against that trigger: in the
 * px of the overlay's containing block. Before the overlay is mounted there is no block to read, and the rect is
 * returned as given.
 */
export function targetInBlockUnits(rect: DOMRectReadOnly, overlay: HTMLElement | null): DOMRect {
  return overlay ? inBlockUnits(rect, blockFrame(containingBlock(overlay))) : DOMRect.fromRect(rect);
}
