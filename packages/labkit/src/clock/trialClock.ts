import { type Clock, type ClockHandle, type ClockSpec, createClock } from '@weasel-js/clock';

export { type ClockedMix, type ClockPosition, clockPosition } from '@weasel-js/clock';

/** What an instrument declares to get a clock; see `ClockSpec`. */
export type ClockCapability = ClockSpec;
/** A trial's time; see `Clock`. */
export type TrialClock = Clock;
/** A trial's clock and what labkit does with it; see `ClockHandle`. */
export type TrialClockHandle = ClockHandle;
/** A trial's clock, opened from its declaration. */
export const createTrialClock = createClock;
