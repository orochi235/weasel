import { getOwn } from '@weasel-js/registry';
import type { BoundClip } from './clip';
import type { TimelineOptions } from './types';

/**
 * What `animator.timeline` takes to play the range `name` of a bound clip: the clip as one nested
 * track whose remap window is the range, as blits plays a voice cued with that window. It plays
 * `[start, end]` of the clip's time and stops, or with `loop`, which `TimelineOptions.loop` counts,
 * plays that stretch over again. A range whose end is before its start plays backward.
 */
export function rangeTimeline(clip: BoundClip, name: string, opts: Pick<TimelineOptions, 'loop' | 'label'> = {}): TimelineOptions {
  const range = clip.ranges && getOwn(clip.ranges, name);
  if (!range) throw new Error(`rangeTimeline: the clip has no range named "${name}".`);
  return {
    tracks: [{
      kind: 'timeline',
      at: 0,
      timeline: { tracks: clip.tracks, duration: clip.duration },
      remap: { window: [range[0], range[1]] },
    }],
    loop: opts.loop,
    label: opts.label,
  };
}
