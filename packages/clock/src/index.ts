/**
 * @weasel-js/clock — a clock for a run of time. No React and no DOM; the frame
 * loop that drives a registry's clocks is behind `@weasel-js/clock/react`.
 *
 * @packageDocumentation
 */
export { clockPosition, createClock } from './clock';
export { holdAt, type PlayheadHold, shownInPass } from './hold';
export { CLOCK_RATES } from './rates';
export { type ClockRegistry, type ClockTarget, createClockRegistry } from './registry';
export type {
  Clock,
  ClockedMix,
  ClockHandle,
  ClockPosition,
  ClockSpec,
} from './types';
