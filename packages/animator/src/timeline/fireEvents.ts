import { firstAfter, firstAtOrAfter } from './booking';
import type { TimelineReport } from './createTimeline';
import type { Track } from './types';

/** A stated duration as the timeline plays it: refused where `NaN`, which every playhead and
 *  seek would carry. */
export function lengthOf(duration: number): number {
  if (Number.isNaN(duration)) throw new RangeError('timeline: duration is a time, not NaN');
  return duration;
}

/** Fires the events of `tracks` the playhead crossed going from `from` to `to`, at any depth.
 *  With `fromOpen`, an event exactly at `from` fires too. Stops once `moved` says a handler
 *  moved the playhead, and answers whether it did. */
export type FireEvents = (tracks: Track[], from: number, to: number, fromOpen: boolean, moved: () => boolean) => boolean;

/** Where a timeline has fired its events up to. Events fire only going forward: a move back
 *  fires nothing, and the next move forward fires from where it stopped. */
export interface EventCursor {
  /** Fires the events the playhead crossed going to `to`, and stands there, unless a handler
   *  moved the playhead; answers whether one did. */
  to(tracks: Track[], to: number): boolean;
  /** Stands at `t`. With `open`, an event exactly at `t` fires on the next move: where a seek
   *  lands, or a new lap starts. */
  place(t: number, open: boolean): void;
  /** Played backward to `t`: fires nothing, not even an event a seek left it open on, and stands
   *  there if it is behind the cursor. Answers false, as `to` does when no handler moved. */
  back(t: number): false;
}

export function createEventCursor(fire: FireEvents): EventCursor {
  let at = -Infinity;
  let open = false;
  let places = 0;
  return {
    to(tracks, to) {
      const was = places;
      // A handler that seeks has placed the cursor where playback goes on from.
      if (fire(tracks, at, to, open, () => places !== was)) return true;
      at = to;
      open = false;
      return false;
    },
    place(t, o) {
      at = t;
      open = o;
      places += 1;
    },
    back(t) {
      if (t < at) {
        at = t;
        open = false;
      }
      return false;
    },
  };
}

/** `booked` says whether the timeline has a booking clock: an event with `book` on one that has
 *  none warns, once. */
export function createEventFirer(report: TimelineReport | undefined, booked: boolean): FireEvents {
  // Track indexes from the root down to the track being fired, for `report`.
  const path: number[] = [];
  let warnedUnbooked = false;
  const fire: FireEvents = (tracks, from, to, fromOpen, moved) => {
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
          if (moved()) return true;
        }
      } else if (track.kind === 'timeline') {
        const end = track.timeline.duration == null ? Infinity : lengthOf(track.timeline.duration);
        if (from - track.at > end) continue;
        path.push(k);
        const stopped = fire(track.timeline.tracks, from - track.at, Math.min(to - track.at, end), fromOpen, moved);
        path.pop();
        if (stopped) return true;
      }
    }
    return false;
  };
  return fire;
}
