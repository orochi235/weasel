import { useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import s from './Callout.module.css';

/** Far past the 1/64px a browser lays out in, and far short of anything seen. */
const ANCHOR_NUDGE_PX = 1 / 16;

type Rect = { x: number; y: number; width: number; height: number };

/**
 * How far to widen the anchor this render. RAC repositions when the anchor changes size, through its own
 * ResizeObserver, and not when it only moves, as it does when a consumer tracks a scene node across a pan. Popover
 * has no public updatePosition, so each move also flips the anchor's width by a fraction of a pixel, which that
 * observer sees and nothing else does.
 */
export function useAnchorNudge(rect: Rect | undefined): number {
  const [seen, setSeen] = useState({ x: rect?.x, y: rect?.y, flip: false });
  if (seen.x !== rect?.x || seen.y !== rect?.y) {
    setSeen({ x: rect?.x, y: rect?.y, flip: !seen.flip });
  }
  return seen.flip ? ANCHOR_NUDGE_PX : 0;
}

/** An invisible element on `document.body` covering `rect` in client coordinates, for a popover to anchor to. */
export function RectAnchor({ rect, nudge, anchorRef }: { rect: Rect; nudge: number; anchorRef: RefObject<HTMLSpanElement | null> }) {
  return createPortal(
    <span
      ref={anchorRef}
      data-callout-anchor=""
      className={s.anchor}
      aria-hidden="true"
      // Dynamic geometry — inline style is the mechanism here, not styling.
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width + nudge,
        height: rect.height,
      }}
    />,
    document.body,
  );
}
