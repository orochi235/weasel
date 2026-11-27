import type { NestedTimeline, Track } from './types';

/** A stated duration as the timeline plays it: refused where `NaN`, which every playhead and
 *  seek would carry, and none below 0, as a tween of 0 or less ends at once. */
export function lengthOf(duration: number): number {
  if (Number.isNaN(duration)) throw new RangeError('timeline: duration is a time, not NaN');
  return Math.max(0, duration);
}

/** Where a timeline ends: its `duration` read through `length` (default {@link lengthOf}), or with none, its last
 *  track's end, a nested timeline's taken from its own. */
export function timelineEnd(timeline: NestedTimeline, length: (duration: number) => number = lengthOf): number {
  if (timeline.duration != null) return length(timeline.duration);
  let end = 0;
  for (const track of timeline.tracks) end = Math.max(end, trackEnd(track, length));
  return end;
}

function trackEnd(track: Track, length: (duration: number) => number): number {
  switch (track.kind) {
    case 'sampled': return track.keys.at(-1)?.t ?? 0;
    case 'event': return track.events.at(-1)?.t ?? 0;
    case 'timeline': return track.at + timelineEnd(track.timeline, length);
  }
}

/** How long a nested timeline plays, as firing, sampling and booking all read it: endless with no `duration`. */
export const nestedLength = (timeline: NestedTimeline): number =>
  (timeline.duration == null ? Infinity : lengthOf(timeline.duration));
