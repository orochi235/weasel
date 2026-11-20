import type { Hud } from './hud';
import type { HudPointerEvent, Widget } from './widget';

/** The presses `hud.press` opened on widgets that no click or drag has closed yet. */
export interface OpenPresses {
  /** `hud` is the HUD `widget` is on: one taken off it before the sweep hears no `cancel`. */
  opened(widget: Widget, hud?: Hud): void;
  /** A click or a drag's end is closing `widget`'s press with its own `up` or `cancel`. */
  closed(widget: Widget): void;
  /** Close what each release, pointer cancel or window blur in `win` leaves open. Returns the unwatch. */
  watch(win: Window): () => void;
}

/** Whether `w` is still on `hud` and not disposed: a widget taken off it hears nothing more from the pointer. */
export function onHud(hud: Hud, w: Widget): boolean {
  return w.disposed !== true && hud.widgets().includes(w);
}

const CANCEL: HudPointerEvent = { type: 'cancel', native: null };

/**
 * A long-press, a second finger joining a pinch, or a pointer the browser takes back spends a press
 * without the click or drag that would send its `up`. Without this a button stays lit and a held stepper
 * chip keeps repeating. A release closes what it left open a task later, once the dispatcher has sent
 * its click or ended its drag, and only the presses open when it happened.
 */
export function createOpenPresses(): OpenPresses {
  // Each press is an object of its own, so a sweep can tell a later press on the same widget from the one it saw.
  const open = new Map<Widget, { hud: Hud | undefined }>();
  const sweep = (win: Window) => (): void => {
    const seen = [...open];
    win.setTimeout(() => {
      for (const [widget, press] of seen) {
        if (open.get(widget) !== press) continue;
        open.delete(widget);
        if (press.hud ? onHud(press.hud, widget) : widget.disposed !== true) widget.onPointer(CANCEL);
      }
    }, 0);
  };
  return {
    opened(widget, hud) { open.set(widget, { hud }); },
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
