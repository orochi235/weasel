/**
 * A press that begins on one element and is carried over another: the in-app
 * sibling of an OS drag. The source opens the carry; every dispatcher with a
 * `carry` channel registers its element as a surface, and the one under the
 * pointer dispatches the carry as `carry` events through its bindings.
 */
import {
  openPointerSession,
  type PointerSessionCancelReason,
} from '../pointerSession';
import { canHitTest, containsComposed, elementAt } from '../elementAt';

/** What a carry brings. `type` is what a `carry` spec's `types` globs filter. */
export interface CarryPayload {
  type: string;
  value: unknown;
}

/** The pointer facts a surface reads off each step of a carry. */
export interface CarryPointer {
  clientX: number;
  clientY: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** What a carry did on a surface: came over it, moved on it, was released on
 *  it, or left it — off it, or canceled while over it. A `drop` closes the carry
 *  on that surface whether or not the surface took it; no `leave` follows. */
export type CarryStage = 'enter' | 'move' | 'drop' | 'leave';

/** An element a carry can be released on. */
export interface CarrySurface {
  element: Element;
  receive(
    stage: CarryStage,
    payload: CarryPayload,
    at: CarryPointer,
    pointerId: number,
  ): 'handled' | 'unhandled';
}

/** What {@link startCarry} reports to its source. Exactly one of `onEnd` /
 *  `onCancel` fires. */
export interface CarryCallbacks {
  /** Every move of the carrying pointer. */
  onMove?: (e: PointerEvent) => void;
  /** The pointer was released. `taken` is whether a binding on the surface
   *  under it took the carry. */
  onEnd?: (result: { taken: boolean; event: PointerEvent }) => void;
  /** The carry ended without a release. Any surface it was over has had its leave. */
  onCancel?: (reason: PointerSessionCancelReason) => void;
}

/** A live carry, opened by {@link startCarry}. */
export interface Carry {
  readonly pointerId: number;
  readonly active: boolean;
  /** End the carry now, as a cancel. Idempotent. */
  cancel(): void;
}

const surfaces = new Set<CarrySurface>();

/** Register `surface`; the returned function removes it. */
export function addCarrySurface(surface: CarrySurface): () => void {
  surfaces.add(surface);
  return () => {
    surfaces.delete(surface);
  };
}

function contains(r: DOMRect, x: number, y: number): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/** The innermost surface under the point that nothing else on the page covers. */
function surfaceAt(x: number, y: number): CarrySurface | null {
  const hits = new Map<Node, Element | null>();
  let best: CarrySurface | null = null;
  for (const s of surfaces) {
    if (!contains(s.element.getBoundingClientRect(), x, y)) continue;
    const root = s.element.getRootNode();
    if (!hits.has(root)) hits.set(root, elementAt(s.element, x, y));
    const hit = hits.get(root);
    if (hit ? !containsComposed(s.element, hit) : canHitTest(s.element)) continue;
    if (best && containsComposed(s.element, best.element)) continue;
    best = s;
  }
  return best;
}

/**
 * Carry `payload` from the press `down` on `origin` until the pointer is
 * released, the press is canceled, the window loses focus, or a move says the
 * release came where the document never saw it. While it moves, the surface under it
 * hears the carry come over, move, and leave; a release over one is a drop
 * there. The press is captured to `origin` as any drag is, so nothing the
 * pointer passes over sees it as a press of its own.
 */
export function startCarry(
  origin: Element,
  down: PointerEvent | React.PointerEvent,
  payload: CarryPayload,
  cb: CarryCallbacks = {},
): Carry {
  const pointerId = down.pointerId;
  let over: CarrySurface | null = null;

  const leave = (at: CarryPointer): void => {
    const was = over;
    over = null;
    if (was && surfaces.has(was)) was.receive('leave', payload, at, pointerId);
  };

  const step = (at: CarryPointer): void => {
    const next = surfaceAt(at.clientX, at.clientY);
    if (next === over) {
      over?.receive('move', payload, at, pointerId);
      return;
    }
    leave(at);
    over = next;
    next?.receive('enter', payload, at, pointerId);
  };

  let last: CarryPointer = down;
  // A release the document never saw was let go somewhere unknown, so it drops nowhere.
  const session = openPointerSession(origin, down, {
    onMove: (e) => {
      last = e;
      step(e);
      cb.onMove?.(e);
    },
    onEnd: (e) => {
      step(e);
      const on = over;
      over = null;
      const taken = on !== null && surfaces.has(on) && on.receive('drop', payload, e, pointerId) === 'handled';
      cb.onEnd?.({ taken, event: e });
    },
    onCancel: (reason) => {
      leave(last);
      cb.onCancel?.(reason);
    },
  }, { missedRelease: 'cancel' });

  return {
    pointerId,
    get active() {
      return session.active;
    },
    cancel: () => session.cancel(),
  };
}
