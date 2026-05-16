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

/** Controls how aggressively the recorder samples pointermove. Other event
 *  types (down/up/cancel/wheel/key) are always captured regardless.
 *
 *  - `gesture-only` (default) — pointermove only between pointerdown and
 *    the matching pointerup/pointercancel. Idle drift between gestures is
 *    dropped, which typically removes 70–90% of all recorded events with
 *    no replay-quality impact (idle moves don't influence app state).
 *  - `full` — every pointermove, including idle drift. Use for replaying
 *    hover behaviors or debugging an out-of-gesture surface.
 *  - `events-only` — no pointermove at all. Use for action-level replay
 *    where only down/up/key/wheel matter; loses gesture trajectory. */
export type RecordingProfile = 'gesture-only' | 'full' | 'events-only';

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
  /** Profile this recording was captured with. Replay treats them all
   *  identically — the field is metadata for debugging file size /
   *  faithfulness questions later. Optional for forward-compat with
   *  recordings saved before profiles existed. */
  profile?: RecordingProfile;
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
  start(opts?: {
    snapshotScene?: () => SceneSnapshot | null;
    /** Sampling strategy; default `'gesture-only'`. See `RecordingProfile`. */
    profile?: RecordingProfile;
    /** Minimum spacing in ms between captured pointermove events. Default
     *  16 (≈60Hz). Set to `0` to disable throttling and record every
     *  move (useful for high-fidelity gesture replay or debugging). The
     *  first pointermove inside a gesture is always captured regardless
     *  of throttle so threshold-crossing info isn't lost. */
    throttleMs?: number;
  }): void;
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
  let profile: RecordingProfile = 'gesture-only';
  let throttleMs = 16;
  /** `t` (ms since start) of the most recently captured pointermove.
   *  `-Infinity` lets the first move of a new gesture through unconditionally. */
  let lastMoveT = -Infinity;
  let viewport = { w: 0, h: 0 };
  /** Pointer IDs with an active pointerdown that hasn't seen its matching
   *  up/cancel yet. Used to gate pointermove capture in `gesture-only`. */
  const activeDowns = new Set<number>();

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

  /** Build the modifier subset of a `RecordedEvent`, omitting any falsy
   *  keys so the JSON payload doesn't carry the 80%+ of `:false` noise. */
  const modifiers = (
    e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  ): Partial<Pick<RecordedEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>> => {
    const out: Partial<Pick<RecordedEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>> = {};
    if (e.altKey) out.altKey = true;
    if (e.ctrlKey) out.ctrlKey = true;
    if (e.metaKey) out.metaKey = true;
    if (e.shiftKey) out.shiftKey = true;
    return out;
  };

  const handlePointer = (type: RecordedEvent['type']) => (e: Event): void => {
    if (!active) return;
    const pe = e as PointerEvent;
    if (type === 'pointermove') {
      if (profile === 'events-only') return;
      if (profile === 'gesture-only' && activeDowns.size === 0) return;
      const t = now();
      if (throttleMs > 0 && t - lastMoveT < throttleMs) return;
      lastMoveT = t;
      // Pointermove inside a gesture: `button`/`buttons`/`pointerType`/
      // `pointerId` don't change from the matching pointerdown, so we omit
      // them. Replay reconstitutes via the down event (`?? defaults` in
      // `buildPointerEvent`).
      events.push({
        type,
        t,
        clientX: pe.clientX,
        clientY: pe.clientY,
        ...modifiers(pe),
        target: classifyTarget(pe.target),
      });
      return;
    }
    if (type === 'pointerdown') {
      activeDowns.add(pe.pointerId);
      // Let the first pointermove of every new gesture through, even if it
      // fires immediately after this pointerdown — threshold-crossing info
      // is the most replay-relevant move.
      lastMoveT = -Infinity;
    }
    if (type === 'pointerup' || type === 'pointercancel') activeDowns.delete(pe.pointerId);
    events.push({
      type,
      t: now(),
      clientX: pe.clientX,
      clientY: pe.clientY,
      button: pe.button,
      buttons: pe.buttons,
      ...modifiers(pe),
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
      ...modifiers(we),
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
      ...modifiers(ke),
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
      activeDowns.clear();
      lastMoveT = -Infinity;
      profile = startOpts?.profile ?? 'gesture-only';
      throttleMs = startOpts?.throttleMs ?? 16;
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
          profile,
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
      activeDowns.clear();
      return {
        version: 1,
        startedAt,
        profile,
        viewport,
        scene,
        events: events.slice(),
      };
    },
  };
}
