import type { EventTrack } from '@weasel-js/core';
import { CLIPS } from './clips';

/** The two contacts in one run cycle, in milliseconds. */
export const FOOTFALLS = [0, CLIPS.run.duration / 2];

/**
 * An `EventTrack` firing at each footfall.
 *
 * `fire()` takes no arguments, so the handler is told the *authored* time and
 * has no way to learn the actual crossing time. Anything scheduling audio from
 * here is stuck asking the engine for "now" at frame resolution, which is the
 * jitter this demo is built to expose.
 */
export function footstepTrack(onStep: (authoredT: number) => void): EventTrack {
  return {
    kind: 'event',
    label: 'footsteps',
    events: FOOTFALLS.map((t) => ({ t, fire: () => onStep(t) })),
  };
}
