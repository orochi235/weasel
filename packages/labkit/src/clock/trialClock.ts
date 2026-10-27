import {
  type Clock,
  type ClockHandle,
  type ClockPosition,
  type ClockSpec,
  createClock,
  shownInPass,
} from '@weasel-js/clock';
import type { Instrument } from '../instrument/types';

export { type ClockedMix, type ClockPosition, clockPosition } from '@weasel-js/clock';

/** What an instrument declares to get a clock; see `ClockSpec`. */
export type ClockCapability = ClockSpec;
/** A trial's time; see `Clock`. */
export type TrialClock = Clock;
/** A trial's clock and what labkit does with it; see `ClockHandle`. */
export type TrialClockHandle = ClockHandle;
/** A trial's clock, opened from its declaration. */
export const createTrialClock = createClock;

/** The clock `instrument` declares for `config`: null for none, and for one
 *  playing on the lab's clock. */
export function declaredClock(instrument: Instrument, config: unknown): ClockCapability | null {
  const raw = instrument.clock;
  if (raw === undefined || raw === 'lab') return null;
  return typeof raw === 'function' ? raw(config) : raw;
}

/** The time `position` showed within its pass, on a run of `loop` passes;
 *  `origin` and `duration` stand in for ones it does not record. */
export const shownAt = (
  position: ClockPosition,
  origin: number,
  duration: number,
  loop: boolean | number,
): number =>
  shownInPass(position.origin ?? origin, position.elapsed, position.duration ?? duration, loop);
