/// <reference path="../css-modules.d.ts" />
/**
 * The reason an in-flight gesture cannot land where it is, beside the pointer:
 * the DOM half of the `reason` overlay, which the canvas layers cannot paint
 * as text.
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { canvasToClient, layoutBoxOf, overlaysOf, type Dispatcher } from '@weasel-js/routing';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { resolveOverlays } from 'interactions/actions/resolveOverlays';
import s from './GestureReason.module.css';

/** How far below and right of the pointer the reason sits, in CSS pixels. */
const OFFSET = 14;

export interface GestureReasonProps {
  dispatcher: Dispatcher | null | undefined;
  canvasRef: RefObject<HTMLElement | null>;
  viewRef: RefObject<View>;
}

/** The pointer's client point, and what to say there. */
interface Shown { x: number; y: number; text: string }

/** The first `reason` overlay of the dispatcher's in-flight gestures, shown beside the pointer. */
export function GestureReason({ dispatcher, canvasRef, viewRef }: GestureReasonProps) {
  const [shown, setShown] = useState<Shown | null>(null);
  useEffect(() => {
    if (!dispatcher) return;
    const read = () => {
      const all = [...dispatcher.getInFlightHandles()].flatMap((h) => [...overlaysOf(h)]);
      const reason = resolveOverlays(all).find((o) => o.kind === 'reason');
      const canvas = canvasRef.current;
      const view = viewRef.current;
      if (reason?.kind !== 'reason' || !canvas || !view) {
        setShown(null);
        return;
      }
      const [sx, sy] = worldToScreen(reason.at.x, reason.at.y, viewToTransform(view));
      const [x, y] = canvasToClient(canvas, sx, sy);
      setShown({ x, y, text: reason.text });
    };
    read();
    const off = dispatcher.subscribe(read);
    return () => {
      off();
      setShown(null);
    };
  }, [dispatcher, canvasRef, viewRef]);
  const tagRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (tagRef.current && shown) placeFixedAt(tagRef.current, shown.x, shown.y);
  }, [shown]);
  if (shown === null) return null;
  return <div ref={tagRef} role="status" className={s.reason}>{shown.text}</div>;
}

/**
 * Puts a `position: fixed` element `OFFSET` of its own pixels below and right of a client point.
 * A transformed ancestor makes itself the element's containing block, so `left`/`top` are read in
 * that ancestor's offset, scaled frame: the element is measured at 0, 0 to find where that frame
 * sits. The pointer moves it every frame; nothing but an inline position can follow it.
 */
function placeFixedAt(el: HTMLElement, x: number, y: number): void {
  el.style.left = '0px';
  el.style.top = '0px';
  const origin = layoutBoxOf(el);
  el.style.left = `${(x - origin.left) / origin.scale.x + OFFSET}px`;
  el.style.top = `${(y - origin.top) / origin.scale.y + OFFSET}px`;
}
