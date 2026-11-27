import { passesOf, remapLength, sourceAt } from '@msb235/blits';
import { lengthOf, nestedLength } from './length';
import type { TimelineTrack, Track } from './types';

/** End time of a track: its last key/event, or where a nested timeline stops playing in its parent. */
export function trackEnd(track: Track): number {
  switch (track.kind) {
    case 'sampled': return track.keys.length ? track.keys[track.keys.length - 1].t : 0;
    case 'event': return track.events.length ? track.events[track.events.length - 1].t : 0;
    case 'timeline': {
      const end = track.at + extentOf(track);
      // Played to its out point, so what it shows is hidden there.
      const out = track.window?.[1];
      return out !== undefined && Number.isFinite(out) ? Math.max(end, out) : end;
    }
  }
}

/** How long tracks play: `explicit` where given, else the latest of their ends. */
export function tracksEnd(tracks: Track[], explicit?: number): number {
  if (explicit != null) return lengthOf(explicit);
  let max = 0;
  for (const t of tracks) max = Math.max(max, trackEnd(t));
  return max;
}

/** Whether a nested timeline's clock is retimed against its parent's: a rate, a loop or a remap. */
export const retimed = (track: TimelineTrack): boolean =>
  (track.rate !== undefined && track.rate !== 1) || (track.loop !== undefined && track.loop !== false) || track.remap !== undefined;

/** One pass of a nested timeline, ms of its own clock before a remap: its duration, or its tracks' end. */
const ownLength = (track: TimelineTrack): number => tracksEnd(track.timeline.tracks, track.timeline.duration);

/** How long one pass of a retimed nested timeline runs on its clock: its remap's length, or its own. */
function passLength(track: TimelineTrack): number {
  const own = ownLength(track);
  return track.remap ? remapLength(track.remap, own) : own;
}

/** How long a retimed nested timeline's clock runs over all its passes: endless for a loop for good. */
function runLength(track: TimelineTrack): number {
  const pass = passLength(track);
  const passes = passesOf(track.loop ?? false);
  return pass > 0 && Number.isFinite(passes) ? pass * passes : pass > 0 ? Infinity : 0;
}

/**
 * How long a nested timeline plays in its parent's time, from its `at`: its own length unretimed;
 * retimed, its passes at its rate, of which a loop for good counts one, since it does not
 * lengthen its parent. A rate of 0 holds its first frame for as long as its own length.
 */
export function extentOf(track: TimelineTrack): number {
  if (!retimed(track)) return ownLength(track);
  const rate = Math.abs(track.rate ?? 1);
  const run = runLength(track);
  const counted = Number.isFinite(run) ? run : passLength(track);
  return rate > 0 ? counted / rate : ownLength(track);
}

/**
 * Where a nested timeline's own clock stands when its parent's is `t` ms past the track's `at`: as
 * blits plays a voice cued with the track's `rate`, `loop` and `remap`. Unretimed, `t` held to its
 * `duration`. Below 0, its first frame; past its passes, its last. Played backward, at a rate below
 * 0, it starts at its end, as a blits voice does. Pure, so a nested timeline scrubs in any order.
 */
export function nestedTime(track: TimelineTrack, t: number): number {
  if (!retimed(track)) return Math.min(t, nestedLength(track.timeline));
  const rate = track.rate ?? 1;
  const run = runLength(track);
  if (rate < 0 && !Number.isFinite(run)) {
    throw new RangeError('timeline: a nested timeline played backward starts at its end, and one looping for good has none');
  }
  let e = rate < 0 ? run + t * rate : t * rate;
  if (!(e > 0)) e = 0;
  else if (e > run) e = run;
  const own = ownLength(track);
  if (!(own > 0) && !track.remap?.window) return 0;
  return sourceAt(track.remap ?? {}, e, own, track.loop ?? false);
}

/**
 * The stretches of a nested timeline's own clock that its parent crossing from `from` to `to` ms
 * past the track's `at` runs forward through, each with whether the crossing takes in its start:
 * one per pass it touches, split where a loop starts over. Where a pass runs its clock back, as a
 * reversed window or a curve that turns back does, it contributes nothing, as backward playback
 * fires nothing.
 */
export function forwardRuns(track: TimelineTrack, from: number, to: number): [number, number, boolean][] {
  const rate = track.rate ?? 1;
  if (!(rate > 0) || !(to >= from)) return [];
  const pass = passLength(track);
  const run = runLength(track);
  const own = ownLength(track);
  const a = Math.max(0, from * rate);
  const b = Math.min(run, to * rate);
  if (!(b >= a) || !(pass > 0)) return [];
  const at = (e: number): number => sourceAt(track.remap ?? {}, e, own, false);
  const out: [number, number, boolean][] = [];
  for (let p = Math.floor(a / pass); p * pass <= b && p * pass < run; p += 1) {
    const start = p * pass;
    const lo = Math.max(a, start) - start;
    const hi = Math.min(b, start + pass) - start;
    const ca = at(lo);
    const cb = at(hi);
    // A pass that starts inside the crossing, the first one entered from before `at` included, is
    // crossed from its very start, so an event there fires; one starting exactly at its end fires
    // only what is at its start.
    const opens = start > from * rate;
    if (hi > lo ? cb > ca : opens || to === from) out.push([ca, cb, opens]);
  }
  return out;
}
