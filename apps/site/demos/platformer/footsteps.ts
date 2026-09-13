import type { EventBookingHandle, EventTrack } from '@weasel-js/core';
import { CLIPS } from './clips';

/** The two contacts in one run cycle, in milliseconds. */
export const FOOTFALLS = [0, CLIPS.run.duration / 2];

/**
 * An `EventTrack` booking each footfall ahead of its frame.
 *
 * The handler is told which contact this is (its authored time) and the time on
 * the timeline's booking clock the foot lands at. Returning the voice lets a
 * pause or a change of run speed retract a step that has not sounded yet.
 */
export function footstepTrack(
  onStep: (authoredT: number, when: number) => EventBookingHandle | void,
): EventTrack {
  return {
    kind: 'event',
    label: 'footsteps',
    events: FOOTFALLS.map((t) => ({ t, book: (when) => onStep(t, when) })),
  };
}
