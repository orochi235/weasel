/** Input recorder for swillustrator.
 *
 *  Captures pointer / wheel / keyboard events on `document` in the capture
 *  phase so we see them before any app handler can stopPropagation. Each
 *  event is reduced to a serializable `RecordedEvent` carrying just the
 *  fields the replay path needs to synthesize an equivalent native event.
 *
 *  Listeners are only attached between `start()` and `stop()` — when no
 *  recording is in flight, this module is inert and does not interfere
 *  with normal app interaction.
 *
 *  v1 of the format bundles a `SceneSnapshot` taken at `start()` time so a
 *  recording is self-contained: replay can restore the baseline scene
 *  before firing the first event.
 */

import type { SceneSnapshot } from './sceneStore';

export interface RecordedEvent {
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'wheel' | 'keydown' | 'keyup';
  /** Milliseconds since `start()`. Monotonic; first event is near 0. */
  t: number;
  clientX?: number;
  clientY?: number;
  button?: number;
  buttons?: number;
  key?: string;
  deltaX?: number;
  deltaY?: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  pointerType?: string;
  pointerId?: number;
  /** Selector-like target hint. EventTargets aren't serializable; we
   *  classify into three buckets so replay can route to the right node:
   *  the canvas element, the document, or "other" (unknown — replay
   *  falls back to the canvas). */
  target: 'canvas' | 'document' | 'other';
}

export interface Recording {
  version: 1;
  /** ISO timestamp; useful when looking at a saved file. Not used by replay. */
  startedAt: string;
  /** Viewport size at record time. Replay can sanity-check that coordinates
   *  are within plausible range against the current viewport. */
  viewport: { w: number; h: number };
  /** Baseline scene captured at `start()`. Replay can restore this before
   *  firing the first event so the recording is self-contained. May be null
   *  if the caller didn't pass a snapshot fn (e.g. record against live scene). */
  scene: SceneSnapshot | null;
  events: RecordedEvent[];
}

export interface Recorder {
  start(opts?: { snapshotScene?: () => SceneSnapshot | null }): void;
  stop(): Recording;
  isRecording(): boolean;
}

const POINTER_TYPES = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const;
const KEY_TYPES = ['keydown', 'keyup'] as const;

export function createRecorder(opts: { canvas: () => HTMLCanvasElement | null }): Recorder {
  let active = false;
  let startTime = 0;
  let events: RecordedEvent[] = [];
  let scene: SceneSnapshot | null = null;
  let startedAt = '';
  let viewport = { w: 0, h: 0 };

  // Per-listener function references so removal pairs precisely with addition.
  // Each handler is bound once at `start()` and torn down at `stop()`.
  let listeners: Array<{
    type: RecordedEvent['type'];
    fn: (e: Event) => void;
  }> = [];

  const classifyTarget = (target: EventTarget | null): RecordedEvent['target'] => {
    const c = opts.canvas();
    if (c && target === c) return 'canvas';
    if (target === document) return 'document';
    return 'other';
  };

  const now = (): number => performance.now() - startTime;

  const handlePointer = (type: RecordedEvent['type']) => (e: Event): void => {
    if (!active) return;
    const pe = e as PointerEvent;
    events.push({
      type,
      t: now(),
      clientX: pe.clientX,
      clientY: pe.clientY,
      button: pe.button,
      buttons: pe.buttons,
      altKey: pe.altKey,
      ctrlKey: pe.ctrlKey,
      metaKey: pe.metaKey,
      shiftKey: pe.shiftKey,
      pointerType: pe.pointerType,
      pointerId: pe.pointerId,
      target: classifyTarget(pe.target),
    });
  };

  const handleWheel = (e: Event): void => {
    if (!active) return;
    const we = e as WheelEvent;
    events.push({
      type: 'wheel',
      t: now(),
      clientX: we.clientX,
      clientY: we.clientY,
      deltaX: we.deltaX,
      deltaY: we.deltaY,
      altKey: we.altKey,
      ctrlKey: we.ctrlKey,
      metaKey: we.metaKey,
      shiftKey: we.shiftKey,
      target: classifyTarget(we.target),
    });
  };

  const handleKey = (type: 'keydown' | 'keyup') => (e: Event): void => {
    if (!active) return;
    const ke = e as KeyboardEvent;
    events.push({
      type,
      t: now(),
      key: ke.key,
      altKey: ke.altKey,
      ctrlKey: ke.ctrlKey,
      metaKey: ke.metaKey,
      shiftKey: ke.shiftKey,
      target: classifyTarget(ke.target),
    });
  };

  return {
    isRecording() {
      return active;
    },
    start(startOpts) {
      if (active) return;
      active = true;
      startTime = performance.now();
      events = [];
      startedAt = new Date().toISOString();
      viewport = {
        w: typeof window !== 'undefined' ? window.innerWidth : 0,
        h: typeof window !== 'undefined' ? window.innerHeight : 0,
      };
      scene = startOpts?.snapshotScene?.() ?? null;

      // Build & attach listeners. Capture phase + non-passive so we see
      // events before app handlers, including ones that might preventDefault.
      listeners = [];
      for (const t of POINTER_TYPES) listeners.push({ type: t, fn: handlePointer(t) });
      listeners.push({ type: 'wheel', fn: handleWheel });
      for (const t of KEY_TYPES) listeners.push({ type: t, fn: handleKey(t) });
      for (const { type, fn } of listeners) {
        document.addEventListener(type, fn, { capture: true, passive: false });
      }
    },
    stop() {
      if (!active) {
        return {
          version: 1,
          startedAt: startedAt || new Date().toISOString(),
          viewport,
          scene,
          events: [],
        };
      }
      for (const { type, fn } of listeners) {
        document.removeEventListener(type, fn, { capture: true } as EventListenerOptions);
      }
      listeners = [];
      active = false;
      return {
        version: 1,
        startedAt,
        viewport,
        scene,
        events: events.slice(),
      };
    },
  };
}
