import type { Clip } from '@weasel-js/animator';
import { CLIPS } from './clips';

/** The two contacts in one run cycle, in milliseconds. */
export const FOOTFALLS = [0, CLIPS.run.duration / 2];

/** What the clip calls a footfall. The binder books it ahead of its frame. */
export const STEP = 'step';

/** One run cycle's footfalls, looped at ground speed beside the pose. */
export const FOOTSTEPS: Clip = {
  version: 1,
  duration: CLIPS.run.duration,
  tracks: [{ kind: 'event', label: 'footsteps', events: FOOTFALLS.map((t) => ({ t, name: STEP })) }],
};
