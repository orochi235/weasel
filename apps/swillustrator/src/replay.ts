/** Input replay for swillustrator.
 *
 *  Walks a `Recording`, synthesizing native PointerEvent / WheelEvent /
 *  KeyboardEvent objects and dispatching them at the right target.
 *
 *  Modes:
 *   - `realtime` paces events using their recorded `t` (setTimeout deltas).
 *   - `flush` fires as fast as the event loop allows, with a single rAF
 *     yield between events so React effects and the canvas's rAF-scheduled
 *     paints get a chance to run before the next input lands.
 */

import { decodeModifiers, type Recording, type RecordedEvent } from './recorder';

export interface ReplayOptions {
  /** Where to dispatch canvas-targeted events. Events recorded with
   *  `target: 'other'` also fall back to this element. */
  canvas: HTMLCanvasElement;
  /** Pacing. Defaults to `'realtime'`. */
  mode?: 'realtime' | 'flush';
  /** Runs once before the first event fires. Awaited if it returns a Promise.
   *  Typical use: restore the recording's bundled scene snapshot. */
  beforeFirstEvent?: () => Promise<void> | void;
  /** Per-event progress callback — fired just before dispatch. */
  onEvent?: (e: RecordedEvent, i: number) => void;
}

function rafTick(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(() => resolve(), 0);
    }
  });
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickTarget(rec: RecordedEvent, canvas: HTMLCanvasElement): EventTarget {
  if (rec.target === 'document') return document;
  // 'canvas' and 'other' both route to the canvas — 'other' may have come
  // from an element the recorder couldn't classify (e.g. a sidebar button),
  // but the canvas is a safe fallback since synthesized events bubble.
  return canvas;
}

function buildPointerEvent(rec: RecordedEvent): PointerEvent {
  return new PointerEvent(rec.type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: rec.clientX,
    clientY: rec.clientY,
    button: rec.button ?? 0,
    buttons: rec.buttons ?? 0,
    ...decodeModifiers(rec),
    pointerType: rec.pointerType ?? 'mouse',
    pointerId: rec.pointerId ?? 1,
    isPrimary: true,
  });
}

function buildWheelEvent(rec: RecordedEvent): WheelEvent {
  return new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: rec.clientX,
    clientY: rec.clientY,
    deltaX: rec.deltaX ?? 0,
    deltaY: rec.deltaY ?? 0,
    ...decodeModifiers(rec),
  });
}

function buildKeyboardEvent(rec: RecordedEvent): KeyboardEvent {
  return new KeyboardEvent(rec.type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    key: rec.key ?? '',
    ...decodeModifiers(rec),
  });
}

function buildEvent(rec: RecordedEvent): Event {
  switch (rec.type) {
    case 'pointerdown':
    case 'pointermove':
    case 'pointerup':
    case 'pointercancel':
      return buildPointerEvent(rec);
    case 'wheel':
      return buildWheelEvent(rec);
    case 'keydown':
    case 'keyup':
      return buildKeyboardEvent(rec);
  }
}

export async function replayRecording(rec: Recording, opts: ReplayOptions): Promise<void> {
  const mode = opts.mode ?? 'realtime';
  if (opts.beforeFirstEvent) {
    await opts.beforeFirstEvent();
  }
  let prevT = 0;
  for (let i = 0; i < rec.events.length; i++) {
    const ev = rec.events[i];
    if (i > 0) {
      if (mode === 'realtime') {
        await sleep(ev.t - prevT);
      } else {
        await rafTick();
      }
    }
    opts.onEvent?.(ev, i);
    const target = pickTarget(ev, opts.canvas);
    const native = buildEvent(ev);
    target.dispatchEvent(native);
    prevT = ev.t;
  }
}
