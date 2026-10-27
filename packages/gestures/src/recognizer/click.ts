/** A press released in place: its click, and the double click a second one makes. */
import type { InputEvent } from '../ui/inputEvent';
import type { Point } from './multiTouch';
import { clickEvents, type PressFacts, type ReleaseFacts } from './pressFacts';
import { DOUBLE_CLICK_MAX_MS, DOUBLE_CLICK_MAX_PX } from './thresholds';

/**
 * The click a double click would follow. Held by the host rather than the
 * recognizer when it has to outlive one: a host that rebuilds its recognizer
 * between two clicks would otherwise drop the double click.
 */
export interface ClickMemory {
  last: { t: number; clientX: number; clientY: number } | null;
}

/** Told of clicks without competing for them, as a binding would. */
export interface ClickObserver {
  /** After the click was dispatched, so whatever its binding changed is readable. */
  click?(world: Point): void;
  /** Before the double click is dispatched, whichever binding then handles it. */
  doubleClick?(world: Point): void;
}

/** What a release composed. `doubleClick` is absent unless one was dispatched. */
export interface ReleaseOutcome {
  doubleClick?: 'handled' | 'unhandled';
}

/** How close in time and place two clicks land to make a double click. */
export interface DoubleClickLimits {
  maxMs: number;
  maxPx: number;
}

export function composeClick(
  down: PressFacts,
  up: ReleaseFacts,
  clicks: ClickMemory,
  now: () => number,
  dispatch: (ev: InputEvent) => 'handled' | 'unhandled',
  observer: ClickObserver,
  limits: DoubleClickLimits = { maxMs: DOUBLE_CLICK_MAX_MS, maxPx: DOUBLE_CLICK_MAX_PX },
): ReleaseOutcome {
  const evs = clickEvents(down, up);
  const { world } = up;
  dispatch(evs.click);
  observer.click?.(world);

  const t = now();
  const prev = clicks.last;
  const follows = prev !== null
    && t - prev.t < limits.maxMs
    && Math.hypot(up.clientX - prev.clientX, up.clientY - prev.clientY) < limits.maxPx;
  if (!follows) {
    clicks.last = { t, clientX: up.clientX, clientY: up.clientY };
    return {};
  }
  observer.doubleClick?.(world);
  const doubleClick = dispatch(evs.doubleclick);
  // Start over, so a third click composes nothing with the second.
  clicks.last = null;
  return { doubleClick };
}
