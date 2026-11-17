import type { NestedTimeline } from './types';

/** A stated duration as the timeline plays it: refused where `NaN`, which every playhead and
 *  seek would carry, and none below 0, as a tween of 0 or less ends at once. */
export function lengthOf(duration: number): number {
  if (Number.isNaN(duration)) throw new RangeError('timeline: duration is a time, not NaN');
  return Math.max(0, duration);
}

/** How long a nested timeline plays, as firing, sampling and booking all read it: endless with no `duration`. */
export const nestedLength = (timeline: NestedTimeline): number =>
  (timeline.duration == null ? Infinity : lengthOf(timeline.duration));
