/**
 * The long-press the gesture dispatcher is timing, as observable state: where
 * the press landed, when the hold started, how far through it is, and whether
 * any binding would fire on it. Feedback — a filling ring, a haptic — reads
 * this; nothing here decides what the feedback looks like.
 */

/** A press being held toward a long-press. */
export interface PendingLongPress {
  pointerId: number;
  /** Long-press is synthesized for these two only; a mouse never arms one. */
  pointerType: 'touch' | 'pen';
  /** Where the press landed, in client coordinates. */
  client: { x: number; y: number };
  /** The same point in CSS pixels from the canvas element's top-left — what a
   *  `space: 'screen'` layer draws in. */
  local: { x: number; y: number };
  /** The same point in the routed view's world coordinates. */
  world: { x: number; y: number };
  /** The view the press routed to; `null` is the root view. */
  viewId: string | null;
  /** `performance.now()` when the hold started. */
  startedAt: number;
  /** How long the hold must last before the long-press fires, in ms. */
  duration: number;
  /**
   * Whether holding to the end would fire anything — a `longPress` binding,
   * or a `contextMenu` binding through the fallback. Resolved at press time.
   * Feedback shows only when this is true: a press that will do nothing must
   * not promise that it will.
   */
  armed: boolean;
}

/** Read side of the pending long-press. Published as the `longPress` dep. */
export interface LongPressState {
  /** The press being held, or `null` when none is. Cleared when the
   *  long-press fires, and when movement, release, cancel or a second
   *  pointer abandons it. */
  get(): PendingLongPress | null;
  /** How far through the hold the pending press is, 0→1, at `now`
   *  (`performance.now()` by default). 0 when nothing is pending. */
  progress(now?: number): number;
  /** Called whenever {@link get} changes. Progress is derived from the
   *  clock, so it does not notify — a loop drawing it asks for frames. */
  subscribe(fn: () => void): () => void;
}

/** The dispatcher's writable half of {@link LongPressState}. */
export interface LongPressStore extends LongPressState {
  set(next: PendingLongPress | null): void;
}

/** How long a touch or pen press is held before it fires `longPress`, in ms. */
export const LONG_PRESS_MS = 500;

/** How `useGestureDispatcher` times, publishes and signals a long-press. */
export interface LongPressOptions {
  /** Hold time in ms. Default {@link LONG_PRESS_MS}. */
  duration?: number;
  /**
   * Where the press being held is published: position, start time, progress,
   * and whether any binding would fire on it. `<SceneCanvas>` passes one and
   * republishes it as the `longPress` dep, which its default press ring
   * reads. Omit it and nothing is published.
   */
  state?: LongPressStore;
  /**
   * Default true. A long-press some binding handled pulses `navigator.vibrate`
   * briefly, for touch and pen pointers, where the API exists.
   */
  haptics?: boolean;
}

const nowMs = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

export function createLongPressStore(): LongPressStore {
  let current: PendingLongPress | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    progress: (now = nowMs()) => {
      if (!current) return 0;
      if (!(current.duration > 0)) return 1;
      const t = (now - current.startedAt) / current.duration;
      return t <= 0 ? 0 : t >= 1 ? 1 : t;
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    set: (next) => {
      if (next === current) return;
      current = next;
      for (const fn of [...listeners]) fn();
    },
  };
}
