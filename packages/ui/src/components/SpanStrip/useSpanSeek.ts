import { useEffect, useRef, type HTMLAttributes, type PointerEvent as ReactPointerEvent } from 'react';
import { arrowMove } from '@weasel-js/quantity';
import { clientToCanvasRect, layoutBoxOf } from '@weasel-js/routing';
import type { Span } from '@weasel-js/ui-input';
import { msAtFraction } from './spanLayout';

/** One arrow-key step, as a fraction of the window; shift takes ten. */
const KEY_STEP = 0.01;

type SeekHandlers = Pick<HTMLAttributes<HTMLDivElement>, 'onKeyDown' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>;

/**
 * The strip's handlers as a slider: a primary press holds at that moment and a drag of that pointer follows it,
 * both sent with `held`; letting go sends the last moment without it, and a lost pointer sends back, without it,
 * where the press began. Other pointers are ignored while one holds. The arrows step, Home and End go to either
 * end. None without `onSeek`.
 */
export function useSpanSeek(win: Span, at: number, onSeek: ((ms: number, held: boolean) => void) | undefined): SeekHandlers {
  const held = useRef<number | null>(null);
  const began = useRef(0);
  // Without `onSeek` no release is heard, so a hold taken before it went away would refuse every press after it.
  useEffect(() => {
    if (!onSeek) held.current = null;
  }, [onSeek]);
  if (!onSeek) return {};
  const msAt = (e: ReactPointerEvent<HTMLDivElement>): number => {
    const box = layoutBoxOf(e.currentTarget);
    const [x] = clientToCanvasRect(box, e.clientX, e.clientY);
    return msAtFraction(win, box.width > 0 ? x / box.width : 0);
  };
  const length = win.to - win.from;
  const clamp = (ms: number): number => Math.min(win.to, Math.max(win.from, ms));
  return {
    onKeyDown: (e) => {
      const move = arrowMove(e.key, e.shiftKey);
      const steps = move ? move.dx - move.dy : 0;
      const to = steps !== 0 ? clamp(at) + steps * KEY_STEP * length : e.key === 'Home' ? win.from : e.key === 'End' ? win.to : null;
      if (to === null) return;
      e.preventDefault();
      onSeek(clamp(to), false);
    },
    onPointerDown: (e) => {
      if (e.button !== 0 || held.current !== null) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      held.current = e.pointerId;
      began.current = at;
      onSeek(msAt(e), true);
    },
    onPointerMove: (e) => {
      if (held.current === e.pointerId) onSeek(msAt(e), true);
    },
    onPointerUp: (e) => {
      if (held.current !== e.pointerId) return;
      held.current = null;
      onSeek(msAt(e), false);
    },
    onPointerCancel: (e) => {
      if (held.current !== e.pointerId) return;
      held.current = null;
      onSeek(began.current, false);
    },
  };
}
