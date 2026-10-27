import type { ClockSpec } from '@weasel-js/clock';
import type { TimelineSpec } from './types';

/** The clock a story's timeline declares. It opens paused at the span's start, and loops unless told not to. */
export function clockSpecOf(spec: TimelineSpec): ClockSpec {
  return { duration: spec.duration, origin: spec.start ?? 0, loop: spec.loop ?? true, speed: spec.rate ?? 1 };
}
