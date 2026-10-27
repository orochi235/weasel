/// <reference path="../css-modules.d.ts" />
/**
 * The reason an in-flight gesture cannot land where it is, beside the pointer:
 * the DOM half of the `reason` overlay, which the canvas layers cannot paint
 * as text.
 */
import { useEffect, useState, type RefObject } from 'react';
import { overlaysOf, type Dispatcher } from '@weasel-js/routing';
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

interface Shown { left: number; top: number; text: string }

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
      const r = canvas.getBoundingClientRect();
      const [sx, sy] = worldToScreen(reason.at.x, reason.at.y, viewToTransform(view));
      setShown({ left: r.left + sx + OFFSET, top: r.top + sy + OFFSET, text: reason.text });
    };
    read();
    const off = dispatcher.subscribe(read);
    return () => {
      off();
      setShown(null);
    };
  }, [dispatcher, canvasRef, viewRef]);
  if (shown === null) return null;
  // The pointer moves it every frame; nothing but an inline position can follow it.
  return <div role="status" className={s.reason} style={{ left: shown.left, top: shown.top }}>{shown.text}</div>;
}
