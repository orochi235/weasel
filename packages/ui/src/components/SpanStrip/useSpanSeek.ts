import { useRef, type HTMLAttributes, type PointerEvent as ReactPointerEvent } from 'react';
import { arrowMove } from '@weasel-js/quantity';
import { clientToCanvasRect, layoutBoxOf } from '@weasel-js/routing';
import { msAtFraction, stripWindow, type SpanStripSpan } from './spanLayout';

/** One arrow-key step, as a fraction of the strip; shift takes ten. */
const KEY_STEP = 0.01;

type SeekHandlers = Pick<HTMLAttributes<HTMLDivElement>, 'onKeyDown' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>;

/**
 * The strip's handlers as a slider: a press holds at that moment and a drag follows it, both sent with `held`;
 * letting go sends the last moment without it, and a lost pointer sends back, without it, where the press began. The arrows step,
 * Home and End go to either end. None without `onSeek`.
 */
export function useSpanSeek(spans: readonly SpanStripSpan[], at: number, onSeek: ((ms: number, held: boolean) => void) | undefined): SeekHandlers {
  const held = useRef(false);
  const began = useRef(0);
  if (!onSeek) return {};
  const msAt = (e: ReactPointerEvent<HTMLDivElement>): number => {
    const box = layoutBoxOf(e.currentTarget);
    const [x] = clientToCanvasRect(box, e.clientX, e.clientY);
    return msAtFraction(spans, box.width > 0 ? x / box.width : 0);
  };
  const length = stripWindow(spans).to;
  return {
    onKeyDown: (e) => {
      const move = arrowMove(e.key, e.shiftKey);
      const steps = move ? move.dx - move.dy : 0;
      const to = steps !== 0 ? at + steps * KEY_STEP * length : e.key === 'Home' ? 0 : e.key === 'End' ? length : null;
      if (to === null) return;
      e.preventDefault();
      onSeek(Math.min(length, Math.max(0, to)), false);
    },
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      held.current = true;
      began.current = at;
      onSeek(msAt(e), true);
    },
    onPointerMove: (e) => {
      if (held.current) onSeek(msAt(e), true);
    },
    onPointerUp: (e) => {
      if (!held.current) return;
      held.current = false;
      onSeek(msAt(e), false);
    },
    onPointerCancel: () => {
      if (!held.current) return;
      held.current = false;
      onSeek(began.current, false);
    },
  };
}
