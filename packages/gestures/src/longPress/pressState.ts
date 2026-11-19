/**
 * The long-press being timed, as observable state: where the press landed,
 * when the hold started, how far through it is, and whether any binding would
 * fire on it. Feedback — a filling ring, a haptic — reads this; nothing here
 * decides what the feedback looks like.
 */
import { createEmitter } from '@weasel-js/registry';

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
   *  long-press fires, and when movement, release, cancel or a second finger
   *  beside a held finger abandons it. A pointer of another kind does not: a
   *  palm resting beside a held pen leaves its hold running. */
  get(): PendingLongPress | null;
  /** How far through the hold the pending press is, 0→1, at `now`
   *  (`performance.now()` by default). 0 when nothing is pending. */
  progress(now?: number): number;
  /** Called whenever {@link get} changes. Progress is derived from the
   *  clock, so it does not notify — a loop drawing it asks for frames. */
  subscribe(fn: () => void): () => void;
}

/** The writable half of {@link LongPressState}, which the dispatcher holds. */
export interface LongPressStore extends LongPressState {
  set(next: PendingLongPress | null): void;
}

const nowMs = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

/** A store holding the press currently being held, or none. Pass it as the dispatcher's `longPress.state`. */
export function createLongPressStore(): LongPressStore {
  let current: PendingLongPress | null = null;
  const changed = createEmitter();
  return {
    get: () => current,
    progress: (now = nowMs()) => {
      if (!current) return 0;
      if (!(current.duration > 0)) return 1;
      const t = (now - current.startedAt) / current.duration;
      // A reading that is no number, a clock or a start of NaN, has not begun.
      return t > 0 ? Math.min(t, 1) : 0;
    },
    subscribe: changed.subscribe,
    set: (next) => {
      if (next === current) return;
      current = next;
      changed.emit();
    },
  };
}
