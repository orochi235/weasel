import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { nearestPortalHost } from '../../overlays/portalHost';
import s from './DragGhost.module.css';

/** Props for `<DragGhost>`. */
export interface DragGhostProps {
  /** The ghost's top-left in client space, and its width — `useReorderDragList`'s `state.ghost` is one. */
  at: { left: number; top: number; width: number };
  /** An element inside the list being dragged from. The ghost portals to its nearest themed ancestor, so it resolves
   *  the list's tokens without being clipped by the list's panel. */
  from: Element;
  /** What to draw: copies of the dragged items, or any stand-in for them. */
  children: ReactNode;
}

/** Whether `el` is the containing block of its fixed-position descendants rather than the viewport. */
function containsFixed(el: Element): boolean {
  const cs = getComputedStyle(el);
  return (
    cs.transform !== 'none' ||
    cs.filter !== 'none' ||
    cs.backdropFilter !== 'none' ||
    cs.perspective !== 'none' ||
    /paint|layout|strict|content/.test(cs.contain)
  );
}

/**
 * What follows the pointer during a drag while the dragged items hold their place: `children` on a raised surface at
 * a client-space point. Hidden from assistive tech and from the pointer, so it never becomes the drop target.
 */
export function DragGhost({ at, from, children }: DragGhostProps) {
  const host = nearestPortalHost(from) ?? document.body;
  const origin = host !== document.body && containsFixed(host) ? host.getBoundingClientRect() : { left: 0, top: 0 };
  // Pixel positioning: the point is the pointer's, known only at runtime.
  const style: CSSProperties = { left: at.left - origin.left, top: at.top - origin.top, width: at.width };
  return createPortal(
    <div className={s.ghost} style={style} aria-hidden="true">
      {children}
    </div>,
    host,
  );
}
