import {
  createPointerRecognizer, DOUBLE_CLICK_MAX_MS, pressButtonOf,
  type DragSpec, type InputEvent, type PointerDownEvent, type PointerSample, type RecognizerClock,
} from '@weasel-js/gestures';
import { after } from '@weasel-js/registry';
import { specOf, take, type CaptureKind, type CapturedSpec } from './captureSpec';

/** The click-and-drag thresholds a capture reads, each defaulting to its constant. */
export interface CaptureThresholds {
  dragPx?: number;
  doubleClickMs?: number;
  doubleClickPx?: number;
}

/** What a browser follows a press with; taken too, or the page acts on a gesture already captured. */
export const TRAILING = ['click', 'auxclick', 'dblclick', 'contextmenu'] as const;

const RELEASE = ['pointermove', 'pointerup', 'pointercancel'] as const;

/**
 * Keep taking, after a capture settles, the moves and release of each pointer
 * in `held` and what the browser follows them with, until the last comes up.
 * A fresh press ends it: a press means a release went missing.
 */
export function guardRelease(target: EventTarget, held: ReadonlySet<number>): void {
  const holding = new Set(held);
  // Its own, so that another capture's guard ending removes only that one.
  const trailing = (e: Event): void => { take(e); };
  const end = (): void => {
    for (const type of TRAILING) target.removeEventListener(type, trailing, true);
    for (const type of RELEASE) target.removeEventListener(type, onPointer, true);
    target.removeEventListener('pointerdown', end, true);
  };
  // The click and dblclick a release goes on to fire arrive in the same task.
  const endSoon = (): void => { setTimeout(end, 0); };
  function onPointer(e: Event): void {
    const p = e as PointerEvent;
    if (!holding.has(p.pointerId)) return;
    take(p);
    if (p.type === 'pointermove') return;
    holding.delete(p.pointerId);
    if (holding.size === 0) endSoon();
  }
  for (const type of TRAILING) target.addEventListener(type, trailing, true);
  if (holding.size === 0) { endSoon(); return; }
  for (const type of RELEASE) target.addEventListener(type, onPointer, true);
  target.addEventListener('pointerdown', end, true);
}

const sampleOf = (e: PointerEvent): PointerSample => ({
  pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, target: e.target, timeStamp: e.timeStamp,
  altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
});

const browserClock: RecognizerClock = {
  now: () => performance.now(),
  setTimer: (fn, ms) => after(ms, fn),
  clearTimer: (cancel) => { (cancel as () => void)(); },
};

/** A running {@link capturePointer}. */
export interface PointerCapture {
  /** Stop listening; gives the pointers still pressed. */
  stop(): ReadonlySet<number>;
  /** Settle on a click held back for a double click, if one is; whether one was. */
  flush(): boolean;
}

/**
 * Listen, through `listen`, for the next pointer gesture of `kinds` and hand
 * its spec to `done`. A press goes through the
 * dispatcher's recognizer, so a click and a drag part where they do on a canvas.
 */
export function capturePointer(
  target: EventTarget,
  kinds: ReadonlySet<CaptureKind>,
  apple: boolean,
  thresholds: CaptureThresholds,
  listen: (type: string, fn: (e: Event) => void) => void,
  done: (spec: CapturedSpec) => void,
): PointerCapture {
  let cancelClick = (): void => {};
  let pendingClick: CapturedSpec | null = null;
  const pressed = new Set<number>();
  let dragPress: PointerDownEvent | null = null;

  const recognized = (ev: InputEvent): 'handled' | 'unhandled' => {
    switch (ev.kind) {
      case 'pointerdown':
        // Without `stage` it is the press held back until it crossed the drag threshold.
        if (!('stage' in ev && ev.stage === 'press')) dragPress = ev;
        return 'unhandled';
      case 'click': {
        if (!kinds.has('click')) return 'unhandled';
        const spec = specOf('click', ev, apple);
        if (!kinds.has('doubleClick')) { done(spec); return 'handled'; }
        cancelClick();
        pendingClick = spec;
        cancelClick = after(thresholds.doubleClickMs ?? DOUBLE_CLICK_MAX_MS, () => { done(spec); });
        return 'handled';
      }
      case 'doubleclick':
      case 'contextmenu': {
        const kind = ev.kind === 'doubleclick' ? 'doubleClick' : 'contextMenu';
        if (!kinds.has(kind)) return 'unhandled';
        done(specOf(kind, ev, apple));
        return 'handled';
      }
      default:
        return 'unhandled';
    }
  };

  const recognizer = createPointerRecognizer({
    clock: browserClock,
    dragPx: () => thresholds.dragPx,
    doubleClickMs: () => thresholds.doubleClickMs,
    doubleClickPx: () => thresholds.doubleClickPx,
    sink: { dispatch: recognized, multiTouchInFlight: () => false },
  });

  /** A pointer event for a press this capture holds, taken from the page; otherwise `null`. */
  const held = (e: Event): PointerEvent | null => {
    const p = e as PointerEvent;
    if (recognizer.positionOf(p.pointerId) === undefined) return null;
    take(p);
    return p;
  };

  listen('pointerdown', (e) => {
    const p = e as PointerEvent;
    take(p);
    // Read as the dispatcher reads it: a pen's eraser is primary, and back and forward are the browser's.
    const button = pressButtonOf(p);
    if (!button) return;
    pressed.add(p.pointerId);
    // An element hears a held pointer's moves and release only while it captures them.
    if (target instanceof Element) {
      try { target.setPointerCapture(p.pointerId); } catch { /* the pointer is already gone */ }
    }
    recognizer.press({ ...sampleOf(p), x: p.clientX, y: p.clientY, pointerType: p.pointerType, pointerButton: button });
  });
  listen('pointermove', (e) => {
    const p = held(e);
    if (p) recognizer.move(sampleOf(p));
  });
  listen('pointerup', (e) => {
    const p = held(e);
    if (!p) return;
    pressed.delete(p.pointerId);
    const drag = dragPress;
    dragPress = null;
    recognizer.release(sampleOf(p));
    if (!drag || !kinds.has('drag')) return;
    const spec: DragSpec = specOf('drag', drag, apple);
    done(drag.pointerButton && drag.pointerButton !== 'primary' ? { ...spec, button: drag.pointerButton } : spec);
  });
  listen('pointercancel', (e) => {
    const p = held(e);
    if (!p) return;
    pressed.delete(p.pointerId);
    dragPress = null;
    recognizer.cancel(p.pointerId);
  });
  for (const type of TRAILING) {
    listen(type, (e) => {
      take(e);
      if (type === 'contextmenu' && kinds.has('contextMenu')) done(specOf('contextMenu', e as MouseEvent, apple));
    });
  }

  return {
    stop: () => {
      cancelClick();
      recognizer.reset();
      return pressed;
    },
    flush: () => {
      if (!pendingClick) return false;
      done(pendingClick);
      return true;
    },
  };
}
