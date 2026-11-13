import { createEmitter } from '@weasel-js/registry';
import type { AnimationHandle } from '../types';
import { createBooker } from './booking';
import { createEventCursor, createEventFirer, lengthOf } from './fireEvents';
import { createTrackSampler, type OpenTrackHold } from './trackHolds';
import type { EventTrack, TimelineEvent, TimelineHandle, TimelineOptions, Track } from './types';

/** The animator's internal `register`, narrowed to what a timeline needs. */
export type TimelineRegister = (seed: {
  id: number;
  cancelKey?: string;
  /** Registers under an existing `cancelKey` without cancelling whoever holds
   *  it. A revived timeline is the same animation, not a new claim on the key. */
  keepExisting?: boolean;
  /** `scale` is the effective time scale this frame advanced at, zero while
   *  paused at any level. */
  tick: (virtualNow: number, scale?: number) => boolean;
  onCancel?: () => void;
  kind: 'timeline';
  label?: string;
  progress?: () => number;
}) => AnimationHandle;

/** Where a timeline reports its crossings and laps to `animator.watch`. Each
 *  call site checks `watched` first, so an unwatched timeline builds nothing. */
export interface TimelineReport {
  readonly watched: boolean;
  /** `path` is a scratch stack the timeline goes on mutating; copy it to keep it. */
  fire(track: EventTrack, path: readonly number[], event: TimelineEvent, lateBy: number): void;
  lap(lap: number): void;
}

const finite = (t: number): number => {
  if (!Number.isFinite(t)) throw new RangeError(`a timeline seeks to a finite time, not ${t}`);
  return t;
};

/** The laps a loop policy allows past the pass it starts on: a count is passes, as a clock's is. */
const lapsOf = (loop: boolean | number): number => (loop === true ? Infinity : loop === false ? 0 : Math.max(1, loop) - 1);

/** Where `t` stands in its lap of `duration`. */
const inLap = (t: number, duration: number): number => ((t % duration) + duration) % duration;

/** `t` less `laps` laps of `duration`. Where the laps alone pass the double range, near
 *  `Number.MAX_VALUE`, where the animator's clock stops, that is where `t` stands in its lap. */
function lessLaps(t: number, laps: number, duration: number): number {
  // No laps of an endless duration are none, not `NaN`.
  if (laps === 0) return t;
  const span = laps * duration;
  return Number.isFinite(span) ? t - span : inLap(t, duration);
}

/** The playhead and its offset from the entry's clock, which stands at `now`, `laps` laps back.
 *  Where the offset would pass the double range, the playhead is where it stands in its lap. */
function lapBack(playhead: number, offset: number, now: number, laps: number, duration: number): [number, number] {
  const span = laps * duration;
  const kept = offset - span;
  if (Number.isFinite(span) && Number.isFinite(kept)) return [playhead - span, kept];
  const next = inLap(playhead, duration);
  return [next, next - now];
}

/** Where a seek to `t` lands: not before 0, nor past `duration` unless laps are left, where it
 *  lands in a later lap, `laps` on, and a time on a seam is the end of the lap before. */
function landing(t: number, duration: number, lapsLeft: number): { at: number; laps: number } {
  const to = Math.max(0, finite(t));
  const laps = duration > 0 && to > duration ? Math.min(Math.ceil(to / duration) - 1, lapsLeft) : 0;
  return { at: Math.min(lessLaps(to, laps, duration), duration), laps };
}

/** End time of a track: its last key/event, or a nested timeline's own end. */
function trackEnd(track: Track): number {
  switch (track.kind) {
    case 'sampled': return track.keys.length ? track.keys[track.keys.length - 1].t : 0;
    case 'event': return track.events.length ? track.events[track.events.length - 1].t : 0;
    case 'timeline': return track.at + tracksEnd(track.timeline.tracks, track.timeline.duration);
  }
}

function tracksEnd(tracks: Track[], explicit?: number): number {
  if (explicit != null) return lengthOf(explicit);
  let max = 0;
  for (const t of tracks) max = Math.max(max, trackEnd(t));
  return max;
}

/** Hands `take` the laps a playhead at or past `duration` has crossed, of those left, all at
 *  once: a frame that skips whole laps fires the outgoing lap's tail and the lap it lands in,
 *  and nothing of the laps in between. Played backward below 0, it hands the laps crossed back
 *  into, of the `lap` behind it, as a count below 0. */
function crossLaps(
  playhead: number, duration: number, loopsLeft: number, lap: number, take: (laps: number) => void,
): void {
  if (duration <= 0) return;
  const laps = playhead >= duration ? Math.min(Math.floor(playhead / duration), loopsLeft)
    : playhead < 0 ? -Math.min(Math.ceil(-playhead / duration), lap) : 0;
  if (laps !== 0) take(laps);
}

/**
 * Create a timeline as a registered animator animation.
 *
 * The playhead is NOT the entry's `virtualNow` directly — it is
 * `virtualNow + offset`, where `offset` is what `seek` and looping move.
 *
 * A finished timeline leaves the animator's table, so `seek` and a
 * duration-extending `edit` re-register it. Staying registered instead would
 * hold a slot — and the rAF loop — open for every timeline ever created.
 */
export function createTimeline(
  register: TimelineRegister,
  id: number,
  opts: TimelineOptions,
  report?: TimelineReport,
  hold?: OpenTrackHold,
): TimelineHandle {
  let duration = tracksEnd(opts.tracks, opts.duration);
  let offset = 0;
  let lastVirtual = 0;
  let playhead = 0;
  /** A held playhead fires nothing: what it sits on waits for playback to move. */
  let held = false;
  let done = false;
  let live = true;
  let canceled = false;
  let wantPaused = opts.autoplay === false;
  let wantScale = 1;

  const edited = createEmitter();
  const { emit: playbackChanged, subscribe: subscribePlayback } = createEmitter();

  let loopsLeft = lapsOf(opts.loop ?? false);
  let lap = 0;

  const booker = opts.booking ? createBooker(opts.booking, {
    tracks: opts.tracks, duration: () => duration, lapsLeft: () => loopsLeft, lap: () => lap, playhead: () => playhead,
  }) : null;
  const sampler = createTrackSampler(hold);

  const events = createEventCursor(createEventFirer(report, booker !== null), () => canceled);

  // Flush the outgoing pass's tail before re-arming, or an event between the
  // last tick and `duration` is dropped whenever a frame straddles the seam.
  const onWrap = (laps: number): void => {
    const sought = !held && laps > 0 && events.to(opts.tracks, duration);
    if (!sought) events.place(laps > 0 ? -Infinity : playhead, false);
    if (report?.watched) report.lap(lap);
  };

  const takeLaps = (laps: number): void => { loopsLeft -= laps; lap += laps; };
  const tick = (virtualNow: number, scale?: number): boolean => {
    lastVirtual = virtualNow;
    const rate = scale ?? (base.isPaused() ? 0 : base.timeScale());
    held = rate === 0;
    // A held playhead a seek left on the seam is the end of its lap until it plays.
    const parked = held && duration > 0 && playhead === duration && loopsLeft > 0;
    if (!parked) {
      playhead = virtualNow + offset;
      crossLaps(playhead, duration, loopsLeft, lap, (laps) => {
        takeLaps(laps);
        [playhead, offset] = lapBack(playhead, offset, virtualNow, laps, duration);
        onWrap(laps);
      });
    }

    const finished = playhead >= duration && !parked;
    // Played backward, it ends at its start as it ends at its end going forward.
    const rewound = rate < 0 && playhead <= 0;
    playhead = Math.min(Math.max(playhead, 0), duration);

    // Sampled before fired, so a handler reads the current frame's values.
    sampler.apply(opts.tracks, playhead);
    const sought = rate > 0 ? events.to(opts.tracks, playhead) : rate < 0 && events.back(playhead);
    // A handler canceled it: it is off the table already, and books nothing more.
    if (canceled) return true;
    booker?.tick(virtualNow, rate);

    if ((finished || rewound) && !done && !sought) { done = true; opts.onDone?.(); playbackChanged(); }
    // Re-read: `onDone` may have seeked back or extended the duration, and
    // retiring the entry would strand the replay its own handler just started.
    if (sought || (rewound ? playhead > 0 : playhead < duration) || parked) return false;
    live = false;
    sampler.release();
    return true;
  };

  // Every cancel path inside the animator routes through here, so a timeline
  // canceled by key or by `cancelAll` is as dead as one canceled by hand.
  const onCancel = (): void => {
    const first = !canceled;
    canceled = true;
    live = false;
    booker?.retract();
    sampler.release();
    if (first) playbackChanged();
  };

  const seed = { id, cancelKey: opts.cancelKey, tick, onCancel, kind: 'timeline' as const, label: opts.label, progress: () => (duration > 0 ? playhead / duration : 1) };
  const base = register(seed);

  // A paused entry's scale is zero, so `virtualNow` never advances and the
  // playhead holds at 0 until the consumer resumes.
  if (opts.autoplay === false) base.pause();

  /** Put a finished timeline back on the animator's table. A re-registered
   *  entry's `virtualNow` restarts at 0, so `offset` carries the playhead. */
  const rearm = (): void => {
    if (canceled || playhead >= duration) return;
    done = false;
    if (live) return;
    booker?.rearm();
    lastVirtual = 0;
    offset = playhead;
    live = true;
    register({ ...seed, keepExisting: true });
    if (wantPaused) base.pause();
    base.setTimeScale(wantScale);
  };

  // Not left to the next frame: whoever seeks or edits and then reads a target sees it.
  const sampleNow = (): void => {
    if (live && playhead >= 0 && playhead <= duration) sampler.apply(opts.tracks, playhead);
  };
  return {
    ...base,
    // Not just `onCancel`: cancelling a finished timeline never reaches the
    // animator, and must still keep a later seek from reviving it.
    cancel() { onCancel(); base.cancel(); },
    // Playback intent is tracked here, not read back from the entry: a revived
    // one is a fresh registration, and defaults to running at scale 1.
    pause() { wantPaused = true; base.pause(); booker?.retract(); playbackChanged(); },
    resume() { wantPaused = false; base.resume(); playbackChanged(); },
    setTimeScale(s) { wantScale = s; base.setTimeScale(s); playbackChanged(); },
    timeScale: () => (live ? base.timeScale() : wantScale),
    isPaused: () => (live ? base.isPaused() : wantPaused),
    seek(to) {
      const { at: t, laps } = landing(to, duration, loopsLeft);
      offset = t - lastVirtual;
      booker?.retract();
      playhead = t;
      if (laps > 0) { takeLaps(laps); if (report?.watched) report.lap(lap); }
      events.place(t, true);
      booker?.seek();
      rearm();
      sampleNow();
      playbackChanged();
    },
    time: () => playhead,
    duration: () => duration,
    tracks: () => opts.tracks,
    setLoop(loop) {
      loopsLeft = lapsOf(loop);
      booker?.retract();
      playbackChanged();
    },
    loop: () => (loopsLeft === Infinity ? true : loopsLeft === 0 ? false : loopsLeft + 1),
    edit(fn) {
      fn();
      sampler.edited();
      duration = tracksEnd(opts.tracks, opts.duration);
      booker?.retract();
      rearm();
      sampleNow();
      edited.emit();
    },
    subscribe: edited.subscribe,
    subscribePlayback,
  };
}
