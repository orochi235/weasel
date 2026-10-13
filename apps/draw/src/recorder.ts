/** Input recorder for WeaselDraw. Captures pointer and wheel events on the surface it is given
 *  (or on `document`), and keyboard events on `document`, in the capture phase so we see them
 *  before any app handler can stopPropagation. Listeners are only attached between `start()`
 *  and `stop()`.
 */

export interface View {
  x: number;
  y: number;
  scale: { x: number; y: number };
}

/** Self-contained baseline captured at `start()` time so replay can restore
 *  the scene and the camera before firing the first recorded event. */
export interface SceneSnapshot {
  version: 2;
  /** The scene as `scene.toJSON()` gives it, already through the JSON
   *  replacer that persistence uses, so it survives `JSON.stringify`. */
  scene: unknown;
  view: View;
}

/** How aggressively the recorder samples pointermove. Other event types are always captured.
 *
 *  - `gesture-only` (default) — pointermove only between pointerdown and the matching
 *    pointerup/pointercancel.
 *  - `full` — every pointermove, including idle drift. Use for replaying hover behaviors.
 *  - `events-only` — no pointermove at all; loses gesture trajectory. */
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
  /** Modifier bitmask: `MOD_ALT | MOD_CTRL | MOD_META | MOD_SHIFT`. Omitted when no
   *  modifiers were held. */
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
  /** EventTargets aren't serializable, so the target is classified: the canvas element, the
   *  document, or "other" (replay falls back to the canvas). */
  target: 'canvas' | 'document' | 'other';
}

/** A `RecordedEvent`'s modifier state as the four flags the DOM event constructors expect.
 *  Falls back to the deprecated boolean fields so legacy recordings still replay. */
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
  /** Profile this recording was captured with. Metadata only: replay treats them all
   *  identically. */
  profile?: RecordingProfile;
  /** Viewport size at record time. Replay can sanity-check that coordinates
   *  are within plausible range against the current viewport. */
  viewport: { w: number; h: number };
  /** Baseline scene captured at `start()`, for replay to restore before the first event.
   *  Null if the caller didn't pass a snapshot fn. */
  scene: SceneSnapshot | null;
  events: RecordedEvent[];
}

export interface Recorder {
  start(opts?: {
    snapshotScene?: () => SceneSnapshot | null;
    /** Sampling strategy; default `'gesture-only'`. See `RecordingProfile`. */
    profile?: RecordingProfile;
    /** Minimum spacing in ms between captured pointermove events. Default 16 (≈60Hz); `0`
     *  records every move. The first pointermove inside a gesture is always captured. */
    throttleMs?: number;
  }): void;
  stop(): Recording;
  isRecording(): boolean;
}

const POINTER_TYPES = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const;
const KEY_TYPES = ['keydown', 'keyup'] as const;

export function createRecorder(opts: {
  canvas: () => Element | null;
  /** Where pointer and wheel input is heard. Defaults to `document`; given the
   *  canvas, a press on the app's own chrome is not part of the recording. */
  surface?: () => EventTarget | null;
  /** A key the host handles itself, such as the one that stops the recording. */
  skipKey?: (e: KeyboardEvent) => boolean;
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
    on: EventTarget;
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

  /** Returns an empty object when no modifier is held, so the spread omits the field
   *  entirely (no `:0` in the JSON). */
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
      // `button`/`buttons`/`pointerType`/`pointerId` don't change from the matching
      // pointerdown, so a move omits them; replay reconstitutes via the down event.
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
      // Let the first pointermove of every new gesture through — threshold-crossing info
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
    if (opts.skipKey?.(ke)) return;
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
      const surface = opts.surface?.() ?? document;
      listeners = [];
      for (const t of POINTER_TYPES) listeners.push({ on: surface, type: t, fn: handlePointer(t) });
      listeners.push({ on: surface, type: 'wheel', fn: handleWheel });
      for (const t of KEY_TYPES) listeners.push({ on: document, type: t, fn: handleKey(t) });
      for (const { on, type, fn } of listeners) {
        on.addEventListener(type, fn, { capture: true, passive: false });
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
      for (const { on, type, fn } of listeners) {
        on.removeEventListener(type, fn, { capture: true } as EventListenerOptions);
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
