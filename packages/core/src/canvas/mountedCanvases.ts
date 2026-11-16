/**
 * Every mounted kit canvas, keyed by the element its input and its
 * client→world conversions measure. DOM chrome that is handed only an element
 * — a text-edit container — finds the camera beneath it here instead of making
 * the consumer thread the view through by hand.
 */
import type { View } from 'core/viewport/view';
import { createReflectable, type Reflection } from '@weasel-js/registry';

/** A mounted canvas as {@link findMountedCanvas} returns it: the element it measures, and its current view. */
export interface MountedCanvas {
  readonly element: HTMLElement;
  getView(): View;
}

const mounted = createReflectable<MountedCanvas, HTMLElement>({ name: 'mounted canvases' });

/** Every mounted kit canvas by its element. A canvas mounting on an element another holds replaces it. */
export const mountedCanvasRegistry: Reflection<MountedCanvas, HTMLElement> = mounted.reflection;

/** Register `entry` until the returned disposer runs. */
export function registerMountedCanvas(entry: MountedCanvas): () => void {
  return mounted.set(entry.element, entry);
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
  for (const { value: entry } of mounted.entries()) {
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
