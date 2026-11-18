import { createBooker } from './booking';
import type { TimelineReport } from './createTimeline';
import { createEventCursor, createEventFirer } from './fireEvents';
import type { Landing, Playhead } from './playhead';
import type { TimelineOptions } from './types';

/** What a timeline's playhead crosses as it moves: the events it fires, the ones it books ahead
 *  on a clock, and the laps it reports. */
export interface Crossings {
  /** At the start of a frame playing at `rate`. A held playhead, at rate 0, fires nothing: what
   *  it sits on waits for playback to move. */
  frame(rate: number): void;
  /** After the playhead wrapped `laps` laps, below 0 when played back. */
  wrapped(laps: number): void;
  /** Fires the events the frame's move crossed; answers whether a handler moved the playhead. */
  fire(): boolean;
  /** Books what the frame's clock reaches; `virtualNow` is the entry's clock. */
  book(virtualNow: number): void;
  /** Stops every booking still ahead, while the playhead stands where they were booked from. */
  retract(): void;
  /** After a seek landed. */
  sought(landed: Landing): void;
  /** After the entry's clock restarted at 0. */
  rearm(): void;
}

/** `gone` says the timeline was canceled, which stops its firing as a handler's seek does. */
export function createCrossings(
  opts: TimelineOptions, pos: Playhead, report: TimelineReport | undefined, gone: () => boolean,
): Crossings {
  const booker = opts.booking ? createBooker(opts.booking, {
    tracks: opts.tracks, duration: pos.duration, lapsLeft: pos.lapsLeft, lap: pos.lap, playhead: pos.time,
  }) : null;
  const events = createEventCursor(createEventFirer(report, booker !== null), gone);
  let rate = 0;

  return {
    frame(r) { rate = r; },
    // Flush the outgoing pass's tail before re-arming, or an event between the
    // last tick and `duration` is dropped whenever a frame straddles the seam.
    wrapped(laps) {
      const sought = rate !== 0 && laps > 0 && events.to(opts.tracks, pos.duration());
      if (!sought) events.place(laps > 0 ? -Infinity : pos.time(), false);
      if (report?.watched) report.lap(pos.lap());
    },
    fire: () => (rate > 0 ? events.to(opts.tracks, pos.time()) : rate < 0 && events.back(pos.time())),
    book(virtualNow) { booker?.tick(virtualNow, rate); },
    retract() { booker?.retract(); },
    sought(landed) {
      if (landed.laps > 0 && report?.watched) report.lap(pos.lap());
      events.place(landed.at, true);
      booker?.seek();
    },
    rearm() { booker?.rearm(); },
  };
}
