import { createEmitter } from '@weasel-js/registry';
import { createCrossings } from './crossings';
import { createEntry, type TimelineRegister } from './entry';
import { timelineEnd } from './nestedClock';
import { createPlayhead, landing, type Playhead } from './playhead';
import { createTrackSampler, type OpenTrackHold, type TrackSampler } from './trackHolds';
import type { EventTrack, TimelineEvent, TimelineHandle, TimelineOptions, Track } from './types';

export type { TimelineRegister } from './entry';

/** Where a timeline reports its crossings and laps to `animator.watch`. Each
 *  call site checks `watched` first, so an unwatched timeline builds nothing. */
export interface TimelineReport {
  readonly watched: boolean;
  /** `path` is a scratch stack the timeline goes on mutating; copy it to keep it. */
  fire(track: EventTrack, path: readonly number[], event: TimelineEvent, lateBy: number): void;
  lap(lap: number): void;
}

/** Samples `tracks` where `pos` stands. Off the animator's table, a finished timeline lets go of
 *  its targets again, each keeping what it now shows. */
function resample(sampler: TrackSampler, tracks: Track[], pos: Playhead, live: boolean): void {
  if (pos.time() < 0 || pos.time() > pos.duration()) return;
  sampler.apply(tracks, pos.time());
  if (!live) sampler.release();
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
  /** -1 while the animator plays every animation backward. */
  direction: () => number = () => 1,
): TimelineHandle {
  const pos = createPlayhead(timelineEnd(opts), opts.loop ?? false);
  let lastVirtual = 0;
  let done = false;
  let canceled = false;

  const edited = createEmitter();
  const { emit: playbackChanged, subscribe: subscribePlayback } = createEmitter();

  const sampler = createTrackSampler(hold, () => canceled);
  const crossings = createCrossings(opts, pos, report, () => canceled);

  const tick = (virtualNow: number, scale?: number): boolean => {
    lastVirtual = virtualNow;
    const rate = scale ?? (entry.isPaused() ? 0 : entry.timeScale());
    crossings.frame(rate);
    // A held playhead a seek left on the seam is the end of its lap until it plays.
    const parked = rate === 0 && pos.onSeam();
    if (!parked) pos.advance(virtualNow, crossings.wrapped);

    const finished = pos.atEnd(false) && !parked;
    const rewound = rate < 0 && pos.atEnd(true);
    pos.clamp();

    // Sampled before fired, so a handler reads the current frame's values.
    sampler.apply(opts.tracks, pos.time());
    // A handler (on the outgoing lap's tail too) or an `onTick` canceled it: it is off the table, and does nothing more.
    if (canceled) return true;
    const sought = crossings.fire();
    if (canceled) return true;
    crossings.book(virtualNow);

    if ((finished || rewound) && !done && !sought) { done = true; opts.onDone?.(); playbackChanged(); }
    // Re-read: `onDone` may have seeked back or extended the duration, and
    // retiring the entry would strand the replay its own handler just started.
    if (sought || (rewound ? pos.time() > 0 : pos.time() < pos.duration()) || parked) return false;
    entry.retire();
    sampler.release();
    return true;
  };

  // Every cancel path inside the animator routes through here, so a timeline
  // canceled by key or by `cancelAll` is as dead as one canceled by hand.
  const onCancel = (): void => {
    const first = !canceled;
    canceled = true;
    entry.retire();
    crossings.retract();
    sampler.release();
    if (first) playbackChanged();
  };

  const seed = { id, cancelKey: opts.cancelKey, tick, onCancel, kind: 'timeline' as const, label: opts.label, progress: () => (pos.duration() > 0 ? pos.time() / pos.duration() : 1) };
  const entry = createEntry(register, seed, opts.autoplay === false);

  /** Put a finished timeline back on the animator's table. A re-registered
   *  entry's `virtualNow` restarts at 0, so `offset` carries the playhead. */
  const rearm = (): void => {
    if (canceled || pos.atEnd(entry.wantScale() * direction() < 0)) return;
    done = false;
    if (entry.live()) return;
    crossings.rearm();
    lastVirtual = 0;
    pos.rebase();
    entry.revive();
  };

  // Not left to the next frame: whoever seeks or edits and then reads a target sees it.
  const sampleNow = (): void => { if (!canceled) resample(sampler, opts.tracks, pos, entry.live()); };
  return {
    ...entry.base,
    // Not just `onCancel`: canceling a finished timeline never reaches the animator, yet a seek must not revive it.
    cancel() { onCancel(); entry.base.cancel(); },
    pause() { entry.pause(); crossings.retract(); playbackChanged(); },
    resume() { entry.resume(); playbackChanged(); },
    setTimeScale(s) { entry.setTimeScale(s); playbackChanged(); },
    timeScale: entry.timeScale,
    isPaused: entry.isPaused,
    isCanceled: () => canceled,
    seek(to) {
      const landed = landing(to, pos.duration(), pos.lapsLeft());
      crossings.retract();
      pos.place(landed, lastVirtual);
      crossings.sought(landed);
      rearm();
      sampleNow();
      playbackChanged();
    },
    time: pos.time,
    duration: pos.duration,
    tracks: () => opts.tracks,
    setLoop(loop) {
      pos.setLoop(loop);
      crossings.retract();
      playbackChanged();
    },
    loop: pos.loop,
    edit(fn) {
      fn();
      sampler.edited();
      pos.setDuration(timelineEnd(opts));
      crossings.retract();
      rearm();
      sampleNow();
      edited.emit();
    },
    subscribe: edited.subscribe,
    subscribePlayback,
  };
}
