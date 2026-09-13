import type { EventBooking, EventBookingHandle, EventTrack, TimelineEvent, Track } from './types';

/** A clock read further than this from the frame clock's prediction is taken
 *  as a discontinuity — a hidden tab, a suspended context — not as jitter. */
const RESYNC_MS = 50;
/** Share of each frame's clock residual folded into the estimate. Small enough
 *  to average out a per-frame read that lands a render quantum early or late;
 *  large enough to follow ppm-scale drift with well under a millisecond of lag. */
const SLEW = 0.05;
/** A pending booking a rate change or resync moves by more than this is
 *  retracted and booked again; anything less is left standing. */
const RETIME_MS = 1;

/** Index of the first event after `t`. Binary search: tracks may be long. */
export function firstAfter(events: EventTrack['events'], t: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].t > t) hi = mid; else lo = mid + 1;
  }
  return lo;
}

/** The timeline state a booker reads. `lap` counts wraps since creation and is
 *  never reset, so a (lap, root time) pair names one crossing for good. */
export interface BookerHost {
  tracks: Track[];
  duration(): number;
  /** Laps still allowed after the current one; `Infinity` when endless. */
  lapsLeft(): number;
  lap(): number;
  playhead(): number;
}

export interface Booker {
  /** After the frame's wraps and crossings. `scale` is the effective one this
   *  frame's virtual time advanced at, zero while paused. */
  tick(virtualNow: number, scale: number): void;
  /** Stop every booking still ahead of both the playhead and the clock, and
   *  let the next tick book that span again. */
  retract(): void;
  /** After the playhead jumped. Call `retract` first, while it still reads the
   *  old playhead. */
  seek(): void;
  /** After the animator restarted the timeline's virtual clock at zero. */
  rearm(): void;
}

/** Every event at root time `<= r` in lap `lap` has been taken. */
interface Cursor { lap: number; r: number }

interface Booking {
  event: TimelineEvent;
  lap: number;
  r: number;
  when: number;
  handle?: EventBookingHandle;
}

const isAfter = (a: Cursor, b: Cursor): boolean => a.lap > b.lap || (a.lap === b.lap && a.r > b.r);

export function createBooker(opts: EventBooking, host: BookerHost): Booker {
  const lookahead = opts.lookahead ?? 100;
  const maxLate = opts.maxLate ?? Infinity;
  const cursors = new Map<EventTrack, Cursor>();
  let start: Cursor = { lap: 0, r: -Infinity };
  let bookings: Booking[] = [];
  /** Clock time of the current frame, smoothed. Null until anchored. */
  let est: number | null = null;
  let mapVirtual = 0;
  let lastScale = 0;

  const playheadCursor = (): Cursor => ({ lap: host.lap(), r: host.playhead() });

  const unwrapped = (b: { lap: number; r: number }): number =>
    (b.lap - host.lap()) * host.duration() + b.r;

  const ahead = (b: Booking): boolean => isAfter(b, playheadCursor());

  const stopWhere = (now: number, pred: (b: Booking) => boolean): void => {
    bookings = bookings.filter((b) => {
      if (!b.handle || b.when <= now || !ahead(b) || !pred(b)) return true;
      try { b.handle.stop(); } catch (err) { console.error('timeline: booking stop threw', err); }
      return false;
    });
    // Back to the playhead, not to each retracted booking: whatever still
    // stands is skipped by identity, and an edit may have added events behind
    // the cursor that only a rescan finds.
    const at = playheadCursor();
    for (const [track, c] of cursors) if (isAfter(c, at)) cursors.set(track, at);
    if (isAfter(start, at)) start = at;
  };

  const whenFor = (u: number, playhead: number, scale: number, now: number): number =>
    Math.max(est! + (u - playhead) / scale, now);

  const scanTrack = (
    track: EventTrack, at: number, horizon: number, lastLap: number, now: number, scale: number,
  ): void => {
    const lap = host.lap();
    const duration = host.duration();
    const playhead = host.playhead();
    const { events } = track;
    let c = cursors.get(track) ?? start;
    for (;;) {
      const lapStart = (c.lap - lap) * duration;
      if (lapStart > horizon) break;
      const i = firstAfter(events, c.r - at);
      if (i >= events.length || at + events[i].t > duration) {
        if (c.lap >= lastLap) break;
        // A frame that skipped whole laps books the outgoing lap's tail and
        // nothing of the laps in between, as crossings do.
        c = { lap: Math.max(c.lap + 1, lap), r: -Infinity };
        continue;
      }
      const r = at + events[i].t;
      const u = lapStart + r;
      if (u > horizon) break;
      c = { lap: c.lap, r };
      for (let j = i; j < events.length && events[j].t === events[i].t; j += 1) {
        const ev = events[j];
        if (!ev.book || bookings.some((b) => b.event === ev && b.lap === c.lap)) continue;
        if ((playhead - u) / scale > maxLate) continue;
        const when = whenFor(u, playhead, scale, now);
        let handle: EventBookingHandle | undefined;
        try {
          handle = ev.book(when) ?? undefined;
        } catch (err) {
          console.error('timeline: book threw', err);
        }
        bookings.push({ event: ev, lap: c.lap, r, when, handle });
      }
    }
    cursors.set(track, c);
  };

  const visit = (
    tracks: Track[], at: number, horizon: number, lastLap: number, now: number, scale: number,
  ): void => {
    for (const track of tracks) {
      if (track.kind === 'event') scanTrack(track, at, horizon, lastLap, now, scale);
      else if (track.kind === 'timeline') {
        visit(track.timeline.tracks, at + track.at, horizon, lastLap, now, scale);
      }
    }
  };

  return {
    tick(virtualNow, scale) {
      const now = opts.clock.now();
      bookings = bookings.filter(ahead);
      if (!(scale > 0)) {
        if (lastScale > 0) stopWhere(now, () => true);
        lastScale = 0;
        est = null;
        return;
      }

      let moved = lastScale > 0 && scale !== lastScale;
      if (est === null) {
        est = now;
      } else {
        est += (virtualNow - mapVirtual) / scale;
        const residual = now - est;
        if (Math.abs(residual) > RESYNC_MS) {
          est = now;
          moved = true;
        } else {
          est += residual * SLEW;
        }
      }
      mapVirtual = virtualNow;
      lastScale = scale;

      const playhead = host.playhead();
      if (moved) {
        stopWhere(now, (b) => Math.abs(whenFor(unwrapped(b), playhead, scale, now) - b.when) > RETIME_MS);
      }

      const duration = host.duration();
      const lastLap = host.lap() + (duration > 0 ? host.lapsLeft() : 0);
      visit(host.tracks, 0, playhead + lookahead * scale, lastLap, now, scale);
    },
    retract() {
      stopWhere(opts.clock.now(), () => true);
    },
    seek() {
      bookings = [];
      cursors.clear();
      start = playheadCursor();
    },
    rearm() {
      est = null;
    },
  };
}
