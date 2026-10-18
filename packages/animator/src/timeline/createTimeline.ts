import { createEmitter } from '@weasel-js/registry';
import type { AnimationHandle } from '../types';
import { createBooker } from './booking';
import { createEventCursor, createEventFirer } from './fireEvents';
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

/** End time of a track: its last key/event, or a nested timeline's own end. */
function trackEnd(track: Track): number {
  switch (track.kind) {
    case 'sampled': return track.keys.length ? track.keys[track.keys.length - 1].t : 0;
    case 'event': return track.events.length ? track.events[track.events.length - 1].t : 0;
    case 'timeline': return track.at + tracksEnd(track.timeline.tracks, track.timeline.duration);
  }
}

function tracksEnd(tracks: Track[], explicit?: number): number {
  if (explicit != null) return explicit;
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
  const playback = createEmitter();
  const playbackChanged = playback.emit;

  const loopOpt = opts.loop ?? false;
  let loopsLeft = loopOpt === true ? Infinity : loopOpt === false ? 0 : loopOpt;
  let lap = 0;

  const booker = opts.booking
    ? createBooker(opts.booking, {
      tracks: opts.tracks,
      duration: () => duration,
      lapsLeft: () => loopsLeft,
      lap: () => lap,
      playhead: () => playhead,
    })
    : null;
  const sampler = createTrackSampler(hold);

  const events = createEventCursor(createEventFirer(report, booker !== null));

  // Flush the outgoing pass's tail before re-arming, or an event between the
  // last tick and `duration` is dropped whenever a frame straddles the seam.
  const onWrap = (laps: number): void => {
    if (!held && laps > 0) events.to(opts.tracks, duration);
    events.place(laps > 0 ? -Infinity : playhead, false);
    if (report?.watched) report.lap(lap);
  };

  const tick = (virtualNow: number, scale?: number): boolean => {
    lastVirtual = virtualNow;
    const rate = scale ?? (base.isPaused() ? 0 : base.timeScale());
    held = rate === 0;
    // A held playhead a seek left on the seam is the end of its lap until it plays.
    const parked = held && duration > 0 && playhead === duration && loopsLeft > 0;
    if (!parked) {
      playhead = virtualNow + offset;
      crossLaps(playhead, duration, loopsLeft, lap, (laps) => {
        loopsLeft -= laps;
        offset -= laps * duration;
        playhead -= laps * duration;
        lap += laps;
        onWrap(laps);
      });
    }

    const finished = playhead >= duration && !parked;
    // Played backward, it ends at its start as it ends at its end going forward.
    const rewound = rate < 0 && playhead <= 0;
    playhead = Math.min(Math.max(playhead, 0), duration);

    // Sampled before fired, so a handler reads the current frame's values.
    sampler.apply(opts.tracks, playhead);
    if (!held) events.to(opts.tracks, playhead);
    booker?.tick(virtualNow, rate);

    if ((finished || rewound) && !done) { done = true; opts.onDone?.(); playbackChanged(); }
    // Re-read: `onDone` may have seeked back or extended the duration, and
    // retiring the entry would strand the replay its own handler just started.
    if ((rewound ? playhead > 0 : playhead < duration) || parked) return false;
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
    if (live && playhead >= 0 && playhead < duration) sampler.apply(opts.tracks, playhead);
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
    seek(t) {
      booker?.retract();
      offset = t - lastVirtual;
      playhead = t;
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
      loopsLeft = loop === true ? Infinity : loop === false ? 0 : loop;
      booker?.retract();
      playbackChanged();
    },
    loop: () => (loopsLeft === Infinity ? true : loopsLeft === 0 ? false : loopsLeft),
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
    subscribePlayback: playback.subscribe,
  };
}
