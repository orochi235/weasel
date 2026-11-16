/**
 * Which pointers are down on an element: pressed on it or inside it, with any
 * button, and not yet released. The one answer to "is this move a hover" for
 * everything listening on that element.
 */
export interface HeldPointers {
  count(): number;
  /** Call `listener` whenever {@link count} changes, until the returned function is called or this reader is released. */
  subscribe(listener: () => void): () => void;
  /** Stop reading. The element's listeners go with its last reader. */
  release(): void;
}

interface Tracker {
  readers: number;
  /** Pointer id to whether its press reported button state at all. */
  held: Map<number, boolean>;
  listeners: Set<() => void>;
  detach(): void;
}

const trackers = new WeakMap<Element, Tracker>();

function attach(element: Element): Tracker {
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  const held = new Map<number, boolean>();
  const listeners = new Set<() => void>();
  const changed = (was: number): void => {
    if (held.size !== was) for (const l of [...listeners]) l();
  };
  const down = (e: Event): void => {
    const p = e as PointerEvent;
    const was = held.size;
    held.set(p.pointerId, !!p.buttons);
    changed(was);
  };
  const drop = (id: number): void => {
    const was = held.size;
    held.delete(id);
    changed(was);
  };
  const up = (e: Event): void => { drop((e as PointerEvent).pointerId); };
  // A move with nothing held is the release this document never saw. Read
  // only for a press that reported buttons: synthesized events carry none.
  const move = (e: Event): void => {
    const p = e as PointerEvent;
    if (held.get(p.pointerId) && p.buttons === 0) drop(p.pointerId);
  };
  // A window that loses focus may never deliver the release.
  const blur = (): void => {
    const was = held.size;
    held.clear();
    changed(was);
  };

  // Capture phase, so nothing that stops propagation can hide a press or its release.
  element.addEventListener('pointerdown', down, true);
  doc.addEventListener('pointerup', up, true);
  doc.addEventListener('pointercancel', up, true);
  doc.addEventListener('pointermove', move, true);
  win?.addEventListener('blur', blur);
  return {
    readers: 0,
    held,
    listeners,
    detach() {
      element.removeEventListener('pointerdown', down, true);
      doc.removeEventListener('pointerup', up, true);
      doc.removeEventListener('pointercancel', up, true);
      doc.removeEventListener('pointermove', move, true);
      win?.removeEventListener('blur', blur);
    },
  };
}

/**
 * Read the pointers held on `element`. Every reader of one element shares one
 * set of listeners, so they cannot disagree.
 */
export function heldPointers(element: Element): HeldPointers {
  let tracker = trackers.get(element);
  if (!tracker) {
    tracker = attach(element);
    trackers.set(element, tracker);
  }
  const shared = tracker;
  shared.readers += 1;
  let released = false;
  const mine = new Set<() => void>();
  return {
    count: () => shared.held.size,
    subscribe(listener) {
      if (released) return () => {};
      const own = (): void => listener();
      mine.add(own);
      shared.listeners.add(own);
      return () => {
        mine.delete(own);
        shared.listeners.delete(own);
      };
    },
    release() {
      if (released) return;
      released = true;
      for (const l of mine) shared.listeners.delete(l);
      mine.clear();
      shared.readers -= 1;
      if (shared.readers > 0) return;
      shared.detach();
      if (trackers.get(element) === shared) trackers.delete(element);
    },
  };
}
