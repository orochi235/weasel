import type { HudPointerEvent, Widget } from './widget';

/** The presses `hud.press` opened on widgets that no click or drag has closed yet. */
export interface OpenPresses {
  opened(widget: Widget): void;
  /** A click or a drag's end is closing `widget`'s press with its own `up` or `cancel`. */
  closed(widget: Widget): void;
  /** Close what each release, pointer cancel or window blur in `win` leaves open. Returns the unwatch. */
  watch(win: Window): () => void;
}

const CANCEL: HudPointerEvent = { type: 'cancel', native: null };

/**
 * A long-press, a second finger joining a pinch, or a pointer the browser takes back spends a press
 * without the click or drag that would send its `up`. Without this a button stays lit and a held stepper
 * chip keeps repeating. A release closes what it left open a task later, once the dispatcher has sent
 * its click or ended its drag, and only the presses open when it happened.
 */
export function createOpenPresses(): OpenPresses {
  const open = new Map<Widget, number>();
  let serial = 0;
  const sweep = (win: Window) => (): void => {
    const seen = [...open];
    win.setTimeout(() => {
      for (const [widget, n] of seen) {
        if (open.get(widget) !== n) continue;
        open.delete(widget);
        widget.onPointer(CANCEL);
      }
    }, 0);
  };
  return {
    opened(widget) { open.set(widget, ++serial); },
    closed(widget) { open.delete(widget); },
    watch(win) {
      const onEnd = sweep(win);
      win.addEventListener('pointerup', onEnd, true);
      win.addEventListener('pointercancel', onEnd, true);
      win.addEventListener('blur', onEnd);
      return () => {
        win.removeEventListener('pointerup', onEnd, true);
        win.removeEventListener('pointercancel', onEnd, true);
        win.removeEventListener('blur', onEnd);
      };
    },
  };
}
