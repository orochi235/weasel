/**
 * Every mounted kit canvas, keyed by the element its input and its
 * client→world conversions measure. DOM chrome that is handed only an element
 * — a text-edit container — finds the camera beneath it here instead of making
 * the consumer thread the view through by hand.
 */
import type { View } from 'core/viewport/view';

export interface MountedCanvas {
  readonly element: HTMLElement;
  getView(): View;
}

const mounted = new Map<HTMLElement, MountedCanvas>();

/** Register `entry` until the returned disposer runs. */
export function registerMountedCanvas(entry: MountedCanvas): () => void {
  mounted.set(entry.element, entry);
  return () => {
    if (mounted.get(entry.element) === entry) mounted.delete(entry.element);
  };
}

/**
 * The kit canvas at or inside `root`. When `hint` is given, the canvas that
 * contains it wins — the one a click actually landed on. Otherwise the first
 * in document order.
 */
export function findMountedCanvas(root: Element, hint?: EventTarget | null): MountedCanvas | null {
  if (hint instanceof Node) {
    for (let n: Node | null = hint; n && root.contains(n); n = n.parentNode) {
      const hit = mounted.get(n as HTMLElement);
      if (hit) return hit;
    }
  }
  let first: MountedCanvas | null = null;
  for (const entry of mounted.values()) {
    if (!root.contains(entry.element)) continue;
    if (
      !first
      || first.element.compareDocumentPosition(entry.element) & Node.DOCUMENT_POSITION_PRECEDING
    ) {
      first = entry;
    }
  }
  return first;
}
