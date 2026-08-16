/** Input recorder for WeaselDraw.
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

import type { SerializedHistory } from '@weasel-js/history';
import type { Obj } from './poseUpdate';

/** Per-document metadata bundled into a recording's baseline snapshot. */
export interface Document {
  size: { width: number; height: number };
}

export interface View {
  x: number;
  y: number;
  scale: { x: number; y: number };
}

/** Self-contained baseline scene captured at `start()` time so replay can
 *  restore the scene before firing the first recorded event. (Formerly lived
 *  in the now-removed IndexedDB `sceneStore`; the recorder is its sole
 *  consumer.) */
export interface SceneSnapshot {
  version: 1;
  items: Obj[];
  doc: Document;
  view: View;
  /** Optional — older snapshots predate selection persistence. */
  selection?: string[];
  /** Optional — older snapshots predate history persistence. */
  history?: SerializedHistory;
}

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

/** Bitmask values used in `RecordedEvent.m`. OR together; absent / zero
 *  means no modifiers were held when the event fired. */
export const MOD_ALT = 1;
export const MOD_CTRL = 2;
export const MOD_META = 4;
export const MOD_SHIFT = 8;

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
  /** Modifier bitmask: `MOD_ALT | MOD_CTRL | MOD_META | MOD_SHIFT`. Omitted
   *  when no modifiers were held. Replaces the four separate booleans for
   *  byte-size; the booleans remain readable on legacy recordings for
   *  backward-compat. */
  m?: number;
  /** @deprecated Use `m` (bitmask). Retained for forward-compat with
   *  pre-bitmask recordings. */
  altKey?: boolean;
  /** @deprecated Use `m` (bitmask). */
  ctrlKey?: boolean;
  /** @deprecated Use `m` (bitmask). */
  metaKey?: boolean;
  /** @deprecated Use `m` (bitmask). */
  shiftKey?: boolean;
  pointerType?: string;
  pointerId?: number;
  /** Selector-like target hint. EventTargets aren't serializable; we
   *  classify into three buckets so replay can route to the right node:
   *  the canvas element, the document, or "other" (unknown — replay
   *  falls back to the canvas). */
  target: 'canvas' | 'document' | 'other';
}

/** Decode a `RecordedEvent`'s modifier state into the four flags the DOM
 *  event constructors expect. Reads from `m` (bitmask) when present, else
 *  falls back to the deprecated boolean fields so legacy recordings still
 *  replay correctly. */
export function decodeModifiers(rec: Pick<RecordedEvent, 'm' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>): {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
} {
  if (typeof rec.m === 'number') {
    return {
      altKey: (rec.m & MOD_ALT) !== 0,
      ctrlKey: (rec.m & MOD_CTRL) !== 0,
      metaKey: (rec.m & MOD_META) !== 0,
      shiftKey: (rec.m & MOD_SHIFT) !== 0,
    };
  }
  return {
    altKey: !!rec.altKey,
    ctrlKey: !!rec.ctrlKey,
    metaKey: !!rec.metaKey,
    shiftKey: !!rec.shiftKey,
  };
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

export function createRecorder(opts: {
  canvas: () => HTMLCanvasElement | null;
  /** Monotonic millisecond clock; defaults to `performance.now`. Injecting one
   *  lets tests drive the pointermove throttle without racing wall time. */
  clock?: () => number;
}): Recorder {
  const clock = opts.clock ?? (() => performance.now());
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

  const now = (): number => clock() - startTime;

  /** Build the modifier subset of a `RecordedEvent` as a single bitmask.
   *  Returns `{ m }` when any modifier is held, an empty object otherwise so
   *  the spread omits the field entirely (no `:0` in the JSON). */
  const modifiers = (
    e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  ): { m?: number } => {
    const m =
      (e.altKey ? MOD_ALT : 0) |
      (e.ctrlKey ? MOD_CTRL : 0) |
      (e.metaKey ? MOD_META : 0) |
      (e.shiftKey ? MOD_SHIFT : 0);
    return m === 0 ? {} : { m };
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
      startTime = clock();
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
