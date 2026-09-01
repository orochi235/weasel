import type { EventTrack } from '@weasel-js/core';
import { CLIPS } from './clips';

/** The two contacts in one run cycle, in milliseconds. */
export const FOOTFALLS = [0, CLIPS.run.duration / 2];

/**
 * An `EventTrack` firing at each footfall.
 *
 * The handler is told which contact this is (its authored time) and how far
 * behind the frame the contact was crossed, so it can place the sound against
 * the instant the foot landed rather than the frame that noticed.
 */
export function footstepTrack(
  onStep: (authoredT: number, lateBy: number) => void,
): EventTrack {
  return {
    kind: 'event',
    label: 'footsteps',
    events: FOOTFALLS.map((t) => ({ t, fire: (lateBy) => onStep(t, lateBy) })),
  };
}
