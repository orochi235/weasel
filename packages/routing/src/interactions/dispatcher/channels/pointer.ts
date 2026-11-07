/**
 * The pointer channel: feeds each held pointer's events to the recognizer,
 * and does for it what needs a DOM — sessions, timers, haptics.
 */
import {
  createPointerRecognizer, isInControlWithin, longPressEvents, stylusOf,
  type ClickMemory, type HeldPress, type PointerSample, type RecognizerClock,
} from '@weasel-js/gestures';
import type { KitSettingsStore } from '@weasel-js/react';
import { openPointerSession, type PointerSession } from '../../pointerSession';
import type { PointerDispatchCore } from '../dispatchCore';
import { multiTouchGestureId } from '../dispatcher';
import { LONG_PRESS_HAPTIC_MS, type LongPressOptions } from '../longPressState';
import { underPointer } from '../underPointer';
import type { HoverCursorInput } from './hoverCursor';

type WorldObserver = ((world: { x: number; y: number }) => void) | undefined;

/** Read through thunks, so each answers for the hook's latest render. */
export interface PointerInputOptions {
  longPress(): LongPressOptions | undefined;
  /** The kit settings the `gestures` thresholds are read from, at each use. */
  kitSettings(): KitSettingsStore;
  onClick(): WorldObserver;
  onDoubleClick(): WorldObserver;
  /** Outlives this listener set: a re-bind between two clicks must not drop the double click. */
  clicks: ClickMemory;
  hover: Pick<HoverCursorInput, 'moved' | 'released'>;
}

export interface PointerInput {
  onPointerDown(e: PointerEvent): void;
  /** The canvas's own `pointermove`, left with the unpressed half: a held
   *  pointer's moves arrive through its session, which keeps seeing them once
   *  the pointer has left the canvas. */
  onHoverMove(e: PointerEvent): void;
  onNativeDoubleClick(e: MouseEvent): void;
  /** Whether a touch or pen hold is in progress, firing its long-press if still pending. */
  takeNativeHold(): boolean;
  /** Cancel every held pointer, each through its session, which reports once. */
  cancelHeld(): void;
  /** Where the pointer held longest is, in client pixels; `null` with none held. */
  heldAt(): { clientX: number; clientY: number } | null;
  /** Send every held pointer's last move again, as of now: under a view that
   *  has moved since, the same client point is a new world point. */
  repeatHeld(): void;
  /** A key changed the modifiers: send each held pointer's last move again
   *  with the new ones, so a drag answers Shift or Alt without waiting for the pointer to move. */
  modifiersChanged(e: KeyboardEvent): void;
  /** Drop every held pointer and timer without dispatching. */
  dispose(): void;
}

const sampleOf = (e: PointerEvent): PointerSample => ({
  pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, target: e.target, timeStamp: e.timeStamp,
  altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
  ...stylusOf(e),
});

/** Publishes the press being held, with whether holding it to the end would
 *  fire anything: the two dispatches a long-press makes, predicted without invoking. */
function holdPublisher(core: PointerDispatchCore, longPress: PointerInputOptions['longPress']) {
  return (pending: HeldPress | null): void => {
    const store = longPress()?.state;
    if (!store) return;
    if (!pending) {
      store.set(null);
      return;
    }
    const { press } = pending;
    const evs = longPressEvents(press);
    const d = core.dispatcherNow();
    store.set({
      pointerId: pending.pointerId,
      pointerType: pending.pointerType,
      client: { x: press.clientX, y: press.clientY },
      local: core.toCanvasLocal(press.clientX, press.clientY),
      world: { ...press.world },
      viewId: core.target().id,
      startedAt: pending.startedAt,
      duration: pending.duration,
      armed: d.resolveOnly(evs.longpress, core.ctxNow()) !== null
        || d.resolveOnly(evs.contextmenu, core.ctxNow()) !== null,
    });
  };
}

/**
 * The recognizer's clock. Its one timer is the long-press hold, armed inside
 * `press`, and other input routes elsewhere while that press is held: the hold
 * fires on the view its press went down in.
 */
function holdClock(core: PointerDispatchCore): { clock: RecognizerClock; routeToPress(): void } {
  let holdView: { id: string | null } | null = null;
  return {
    clock: {
      now: () => performance.now(),
      setTimer: (fn, ms) => {
        const view = core.routedView();
        holdView = { id: view };
        return setTimeout(() => {
          holdView = null;
          core.setRoutedView(view);
          fn();
        }, ms);
      },
      clearTimer: (timer) => {
        holdView = null;
        clearTimeout(timer as ReturnType<typeof setTimeout>);
      },
    },
    routeToPress: () => { if (holdView) core.setRoutedView(holdView.id); },
  };
}

/** The reads of the held pointers' last samples: where the longest-held one
 *  is, and each sent again as of now through `resend`, with the modifiers as
 *  they are or as a key just changed them. */
function heldMoves(
  /** Each held pointer's last sample, in press order. */
  last: Map<number, PointerSample>,
  resend: (s: PointerSample) => void,
): Pick<PointerInput, 'heldAt' | 'repeatHeld' | 'modifiersChanged'> {
  return {
    modifiersChanged(e) {
      for (const s of [...last.values()]) {
        if (s.altKey === e.altKey && s.ctrlKey === e.ctrlKey && s.metaKey === e.metaKey && s.shiftKey === e.shiftKey) continue;
        const next = { ...s, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, timeStamp: performance.now() };
        last.set(s.pointerId, next);
        resend(next);
      }
    },
    heldAt() {
      for (const s of last.values()) return { clientX: s.clientX, clientY: s.clientY };
      return null;
    },
    repeatHeld() {
      for (const s of [...last.values()]) resend({ ...s, timeStamp: performance.now() });
    },
  };
}

export function pointerInput(core: PointerDispatchCore, opts: PointerInputOptions): PointerInput {
  const { canvas, routeAt, routeDown, routeRelease, toWorld, target } = core;
  const sessions = new Map<number, PointerSession>();
  const lastSample = new Map<number, PointerSample>();
  const drop = (id: number): void => { sessions.delete(id); lastSample.delete(id); };
  // A double click this dispatcher acted on is spent: the browser's own
  // `dblclick` that follows is marked handled, so a container that opens or
  // toggles on double-click leaves it alone.
  let claimedDoubleClick = false;
  const hold = holdClock(core);

  const recognizer = createPointerRecognizer({
    sink: {
      dispatch: (ev) => core.dispatch(ev),
      multiTouchInFlight: (fingers) => core.dispatcherNow().inFlight().has(multiTouchGestureId(fingers)),
    },
    clock: hold.clock,
    toWorld,
    toSurface: (p) => core.toCanvasLocal(p.x, p.y),
    longPressMs: () => opts.longPress()?.duration ?? opts.kitSettings().get('gestures.longPressMs'),
    doubleClickMs: () => opts.kitSettings().get('gestures.doubleClickMs'),
    doubleClickPx: () => opts.kitSettings().get('gestures.doubleClickPx'),
    tapPx: () => opts.kitSettings().get('gestures.tapPx'),
    dragPx: () => opts.kitSettings().get('gestures.dragPx'),
    clicks: opts.clicks,
    observer: {
      click: (world) => { opts.onClick()?.(world); },
      doubleClick: (world) => { opts.onDoubleClick()?.(world); },
      holdChanged: holdPublisher(core, opts.longPress),
      longPress: () => {
        if (opts.longPress()?.haptics === false) return;
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(LONG_PRESS_HAPTIC_MS);
        }
      },
    },
  });

  const onMove = (e: PointerEvent): void => {
    routeAt(e.pointerId, e.clientX, e.clientY);
    const sample = sampleOf(e);
    if (sessions.has(e.pointerId)) lastSample.set(e.pointerId, sample);
    recognizer.move(sample);
    opts.hover.moved(e);
  };

  const onUp = (e: PointerEvent): void => {
    routeAt(e.pointerId, e.clientX, e.clientY);
    drop(e.pointerId);
    const { doubleClick } = recognizer.release(sampleOf(e));
    if (doubleClick) claimedDoubleClick = doubleClick === 'handled' || opts.onDoubleClick() !== undefined;
    // Everything this release synthesizes has been dispatched, so the pointer's view can be unpinned.
    routeRelease(e.pointerId);
    opts.hover.released(e);
  };

  // Every way a gesture ends without a release.
  const onCancel = (pointerId: number): void => {
    // On teardown every session is canceled at once, and `cancelAll` ends
    // those gestures: dispatching here would end them twice.
    if (core.disposed()) return;
    const at = recognizer.positionOf(pointerId);
    if (!at) return;
    drop(pointerId);
    routeAt(pointerId, at.x, at.y);
    recognizer.cancel(pointerId);
    routeRelease(pointerId);
  };

  return {
    onPointerDown(e) {
      claimedDoubleClick = false;
      // Only the primary button drives gesture dispatch; the others are left
      // for the consumer's own tools and the browser context menu. An absent
      // `button` (synthetic events) counts as primary.
      if ((e.button ?? 0) !== 0) return;
      if (!canvas) return;
      // A button or field laid over the canvas handles its own press: opening a
      // session here would capture the pointer and retarget its click.
      if (isInControlWithin(e.target, canvas)) return;
      routeDown(e.pointerId, e.clientX, e.clientY);
      const w = toWorld(e.clientX, e.clientY);
      const where = underPointer(target(), e, w);
      // The session owns the rest of this pointer: capture, the moves, the
      // release, and recovery from a release that never arrives. A press on a
      // pointer one is already open for cancels that stale gesture before this
      // handler runs: its `pointerdown` listener is on the document, in the
      // capture phase, ahead of this one on the canvas.
      sessions.set(e.pointerId, openPointerSession(canvas, e, {
        onMove, onEnd: onUp, onCancel: () => { onCancel(e.pointerId); },
      }));
      const sample = lastSample.set(e.pointerId, sampleOf(e)).get(e.pointerId)!;
      recognizer.press({ ...sample, x: w.x, y: w.y, pointerType: e.pointerType, ...where });
    },
    onHoverMove(e) {
      if (!sessions.has(e.pointerId)) onMove(e);
    },
    onNativeDoubleClick(e) {
      if (!claimedDoubleClick) return;
      claimedDoubleClick = false;
      e.preventDefault();
    },
    takeNativeHold: () => {
      hold.routeToPress();
      return recognizer.takeHold();
    },
    cancelHeld() {
      for (const session of [...sessions.values()]) session.cancel();
    },
    ...heldMoves(lastSample, (s) => { routeAt(s.pointerId, s.clientX, s.clientY); recognizer.move(s); }),
    dispose() {
      recognizer.reset();
      for (const session of sessions.values()) session.cancel();
      sessions.clear();
      lastSample.clear();
    },
  };
}
