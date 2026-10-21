import {
  createPointerRecognizer, DOUBLE_CLICK_MAX_MS,
  type EventModifiers, type InputEvent, type PointerSample, type RecognizerClock,
} from '@weasel-js/gestures';
import { specOf, take, type CaptureKind, type CapturedSpec } from './captureSpec';

/** The click-and-drag thresholds a capture reads, each defaulting to its constant. */
export interface CaptureThresholds {
  dragPx?: number;
  doubleClickMs?: number;
  doubleClickPx?: number;
}

/** What a browser follows a press with; taken too, or the page acts on a gesture already captured. */
export const TRAILING = ['click', 'auxclick', 'dblclick', 'contextmenu'] as const;

const sampleOf = (e: PointerEvent): PointerSample => ({
  pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, target: e.target, timeStamp: e.timeStamp,
  altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
});

const browserClock: RecognizerClock = {
  now: () => performance.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (t) => { clearTimeout(t as ReturnType<typeof setTimeout>); },
};

/**
 * Listen, through `listen`, for the next pointer gesture of `kinds` and hand
 * its spec to `done`. Returns what stops it. A press goes through the
 * dispatcher's recognizer, so a click and a drag part where they do on a canvas.
 */
export function capturePointer(
  target: EventTarget,
  kinds: ReadonlySet<CaptureKind>,
  apple: boolean,
  thresholds: CaptureThresholds,
  listen: (type: string, fn: (e: Event) => void) => void,
  done: (spec: CapturedSpec) => void,
): () => void {
  let pendingClick: ReturnType<typeof setTimeout> | null = null;
  let dragMods: EventModifiers | null = null;

  const recognized = (ev: InputEvent): 'handled' | 'unhandled' => {
    switch (ev.kind) {
      case 'pointerdown':
        // Without `stage` it is the press held back until it crossed the drag threshold.
        if (!('stage' in ev && ev.stage === 'press')) dragMods = ev;
        return 'unhandled';
      case 'click': {
        if (!kinds.has('click')) return 'unhandled';
        const spec = specOf('click', ev, apple);
        if (!kinds.has('doubleClick')) { done(spec); return 'handled'; }
        if (pendingClick) clearTimeout(pendingClick);
        pendingClick = setTimeout(() => { done(spec); }, thresholds.doubleClickMs ?? DOUBLE_CLICK_MAX_MS);
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
    // Only the primary button presses as the dispatcher sees it; a secondary
    // one reaches a binding as its `contextmenu`.
    if ((p.button ?? 0) !== 0) return;
    // An element hears a held pointer's moves and release only while it captures them.
    if (target instanceof Element) {
      try { target.setPointerCapture(p.pointerId); } catch { /* the pointer is already gone */ }
    }
    recognizer.press({ ...sampleOf(p), x: p.clientX, y: p.clientY, pointerType: p.pointerType });
  });
  listen('pointermove', (e) => {
    const p = held(e);
    if (p) recognizer.move(sampleOf(p));
  });
  listen('pointerup', (e) => {
    const p = held(e);
    if (!p) return;
    const drag = dragMods;
    dragMods = null;
    recognizer.release(sampleOf(p));
    if (drag && kinds.has('drag')) done(specOf('drag', drag, apple));
  });
  listen('pointercancel', (e) => {
    const p = held(e);
    if (!p) return;
    dragMods = null;
    recognizer.cancel(p.pointerId);
  });
  for (const type of TRAILING) {
    listen(type, (e) => {
      take(e);
      if (type === 'contextmenu' && kinds.has('contextMenu')) done(specOf('contextMenu', e as MouseEvent, apple));
    });
  }

  return () => {
    if (pendingClick) clearTimeout(pendingClick);
    recognizer.reset();
  };
}
