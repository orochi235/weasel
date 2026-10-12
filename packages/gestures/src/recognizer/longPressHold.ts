/** The one press being timed toward a long-press. */
import type { PressFacts } from './pressFacts';

/** A clock and a timer, so a host or a test supplies its own. */
export interface RecognizerClock {
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(timer: unknown): void;
}

/** A press held toward a long-press. */
export interface HeldPress {
  pointerId: number;
  /** A mouse never arms one. */
  pointerType: 'touch' | 'pen';
  press: PressFacts;
  /** `RecognizerClock.now()` when the hold started. */
  startedAt: number;
  /** How long the hold must last before the long-press fires, in ms. */
  duration: number;
}

export interface LongPressHold {
  /** Start timing `press`; `fire` runs if it is still pending when its duration is up. */
  arm(press: HeldPress, fire: () => void): void;
  pendingFor(pointerId: number): boolean;
  /** Stop timing the pending press: any, or only `pointerId`'s. */
  cancel(pointerId?: number): void;
}

/**
 * One slot, not one per pointer: only a lone pointer arms a hold, and a second
 * one landing cancels it. `onChange` hears the pending press, and `null` when
 * it fires or is abandoned.
 */
export function createLongPressHold(
  clock: RecognizerClock,
  onChange: (pending: HeldPress | null) => void,
): LongPressHold {
  let pending: { pointerId: number; timer: unknown } | null = null;

  const cancel = (pointerId?: number): void => {
    if (!pending || (pointerId !== undefined && pending.pointerId !== pointerId)) return;
    clock.clearTimer(pending.timer);
    pending = null;
    onChange(null);
  };

  return {
    arm(press, fire) {
      cancel();
      const timer = clock.setTimer(() => {
        pending = null;
        onChange(null);
        fire();
      }, press.duration);
      pending = { pointerId: press.pointerId, timer };
      onChange(press);
    },
    pendingFor: (pointerId) => pending?.pointerId === pointerId,
    cancel,
  };
}
