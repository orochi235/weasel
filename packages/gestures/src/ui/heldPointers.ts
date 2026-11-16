import { createEmitter, type Emitter } from '@weasel-js/registry';

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
  changes: Emitter;
  detach(): void;
}

const trackers = new WeakMap<Element, Tracker>();

function attach(element: Element): Tracker {
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  const held = new Map<number, boolean>();
  const changes = createEmitter();
  const changed = (was: number): void => {
    if (held.size !== was) changes.emit();
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
    changes,
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
  /** This reader's subscriptions, each by the unsubscribe that ends it. */
  const mine = new Map<object, () => void>();
  return {
    count: () => shared.held.size,
    subscribe(listener) {
      if (released) return () => {};
      const token = {};
      // A wrapper, so one listener subscribed twice is two subscriptions, each ended by its own call.
      mine.set(token, shared.changes.subscribe(() => listener()));
      return () => {
        mine.get(token)?.();
        mine.delete(token);
      };
    },
    release() {
      if (released) return;
      released = true;
      for (const unsubscribe of mine.values()) unsubscribe();
      mine.clear();
      shared.readers -= 1;
      if (shared.readers > 0) return;
      shared.detach();
      if (trackers.get(element) === shared) trackers.delete(element);
    },
  };
}
