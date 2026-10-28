import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { fixedSeat } from '@weasel-js/gestures';
import s from './DragGhost.module.css';

/** Props for `<DragGhost>`. */
export interface DragGhostProps {
  /** The ghost's top-left in client space, and its width — `useReorderDragList`'s `state.ghost` is one. With no
   *  width it is as wide as what it holds. */
  at: { left: number; top: number; width?: number };
  /** An element inside the list being dragged from. The ghost portals to its nearest themed ancestor, so it resolves
   *  the list's tokens without being clipped by the list's panel, and draws in this element's font family. */
  from: Element;
  /** What to draw: copies of the dragged items, or any stand-in for them. */
  children: ReactNode;
  /** `at` is the ghost's center rather than its top-left: for a thing that lands centered on the pointer. */
  centered?: boolean;
  /** Draw `children` alone, with no surface under them: for a stand-in that is already the shape it drops. */
  bare?: boolean;
}

/**
 * What follows the pointer during a drag while the dragged items hold their place: `children` on a raised surface at
 * a client-space point. Hidden from assistive tech and from the pointer, so it never becomes the drop target.
 */
export function DragGhost({ at, from, children, centered, bare }: DragGhostProps) {
  const seat = fixedSeat(from);
  // Pixel positioning: the point is the pointer's, known only at runtime. So is the face: the host is an ancestor of
  // whatever set the list's font, and would hand the ghost its own.
  const style: CSSProperties = {
    left: at.left - seat.left, top: at.top - seat.top, width: at.width,
    fontFamily: getComputedStyle(from).fontFamily,
  };
  return createPortal(
    <div className={[s.ghost, centered && s.centered, bare && s.bare].filter(Boolean).join(' ')} style={style} aria-hidden="true">
      {children}
    </div>,
    seat.host,
  );
}
