import { firstAfter, firstAtOrAfter } from './booking';
import type { TimelineReport } from './createTimeline';
import type { Track } from './types';

/** Fires the events of `tracks` the playhead crossed going from `from` to `to`, at any depth.
 *  With `fromOpen`, an event exactly at `from` fires too. */
export type FireEvents = (tracks: Track[], from: number, to: number, fromOpen: boolean) => void;

/** `booked` says whether the timeline has a booking clock: an event with `book` on one that has
 *  none warns, once. */
export function createEventFirer(report: TimelineReport | undefined, booked: boolean): FireEvents {
  // Track indexes from the root down to the track being fired, for `report`.
  const path: number[] = [];
  let warnedUnbooked = false;
  const fire: FireEvents = (tracks, from, to, fromOpen) => {
    for (let k = 0; k < tracks.length; k += 1) {
      const track = tracks[k];
      if (track.kind === 'event') {
        const end = firstAfter(track.events, to);
        const first = (fromOpen ? firstAtOrAfter : firstAfter)(track.events, from);
        for (let i = first; i < end; i += 1) {
          const ev = track.events[i];
          ev.fire?.(to - ev.t);
          if (report?.watched) {
            path.push(k);
            report.fire(track, path, ev, to - ev.t);
            path.pop();
          }
          if (ev.book && !booked && !warnedUnbooked) {
            warnedUnbooked = true;
            console.warn('timeline: an event has `book` but the timeline has no `booking` clock; it never books.');
          }
        }
      } else if (track.kind === 'timeline') {
        path.push(k);
        fire(track.timeline.tracks, from - track.at, to - track.at, fromOpen);
        path.pop();
      }
    }
  };
  return fire;
}
