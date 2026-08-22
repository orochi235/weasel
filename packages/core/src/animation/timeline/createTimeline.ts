import type { AnimationHandle } from '../types';
import { sampleTrack } from './sampleTrack';
import type { SampledTrack, TimelineHandle, TimelineOptions, Track } from './types';

/** The animator's internal `register`, narrowed to what a timeline needs. */
export type TimelineRegister = (seed: {
  id: number;
  cancelKey?: string;
  tick: (virtualNow: number) => boolean;
  onCancel?: () => void;
}) => AnimationHandle;

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

/**
 * Create a timeline as a registered animator animation.
 *
 * The playhead is NOT the entry's `virtualNow` directly — it is
 * `virtualNow + offset`, where `offset` is what `seek` and looping move. That
 * keeps seek and wrap-around entirely inside the timeline and needs no setter
 * on the animator's entry.
 */
export function createTimeline(
  register: TimelineRegister,
  id: number,
  opts: TimelineOptions,
): TimelineHandle {
  let duration = tracksEnd(opts.tracks, opts.duration);
  let offset = 0;
  let lastVirtual = 0;
  let playhead = 0;
  let prevPlayhead = -Infinity;
  let done = false;

  const subscribers = new Set<() => void>();

  const loopOpt = opts.loop ?? false;
  let loopsLeft = loopOpt === true ? Infinity : loopOpt === false ? 0 : loopOpt;

  // Per-sampled-track interpolator-factory caches, dropped wholesale by `edit`.
  // Without this an edited keyframe keeps interpolating toward its old value
  // with no visible error.
  let caches = new WeakMap<object, Map<number, (u: number) => unknown>>();
  const cacheFor = (track: object): Map<number, (u: number) => unknown> => {
    let c = caches.get(track);
    if (!c) { c = new Map(); caches.set(track, c); }
    return c;
  };

  const applySampled = (tracks: Track[], t: number): void => {
    for (const track of tracks) {
      if (track.kind === 'sampled') {
        const st = track as SampledTrack<unknown>;
        const v = sampleTrack(st, t, cacheFor(st) as Map<number, (u: number) => unknown>);
        if (v !== undefined) st.onTick(v);
      } else if (track.kind === 'timeline') {
        applySampled(track.timeline.tracks, t - track.at);
      }
    }
  };

  /** Per-event-track index of the next event to fire. */
  const cursors = new WeakMap<object, number>();
  const cursorOf = (track: object): number => cursors.get(track) ?? 0;

  const fireEvents = (tracks: Track[], from: number, to: number): void => {
    for (const track of tracks) {
      if (track.kind === 'event') {
        let i = cursorOf(track);
        while (i < track.events.length && track.events[i].t <= to) {
          if (track.events[i].t > from) track.events[i].fire();
          i += 1;
        }
        cursors.set(track, i);
      } else if (track.kind === 'timeline') {
        fireEvents(track.timeline.tracks, from - track.at, to - track.at);
      }
    }
  };

  /** Move cursors to `t` WITHOUT firing. Used by seek and by loop wrap. */
  const recursor = (tracks: Track[], t: number): void => {
    for (const track of tracks) {
      if (track.kind === 'event') {
        let i = 0;
        while (i < track.events.length && track.events[i].t <= t) i += 1;
        cursors.set(track, i);
      } else if (track.kind === 'timeline') {
        recursor(track.timeline.tracks, t - track.at);
      }
    }
  };

  // Flush the outgoing pass's tail before re-arming, or an event between the
  // last tick and `duration` is dropped whenever a frame straddles the seam.
  const onWrap = (): void => {
    fireEvents(opts.tracks, prevPlayhead, duration);
    recursor(opts.tracks, -Infinity);
    prevPlayhead = -Infinity;
  };

  const base = register({
    id,
    cancelKey: opts.cancelKey,
    tick(virtualNow) {
      lastVirtual = virtualNow;
      playhead = virtualNow + offset;

      // A single advance can span several loops when frames are long or the
      // duration is short, so wrap in a loop rather than subtracting once.
      while (playhead >= duration && duration > 0 && loopsLeft > 0) {
        loopsLeft -= 1;
        offset -= duration;
        playhead -= duration;
        onWrap();
      }

      fireEvents(opts.tracks, prevPlayhead, Math.min(playhead, duration));
      prevPlayhead = Math.min(playhead, duration);

      if (playhead >= duration) {
        playhead = duration;
        applySampled(opts.tracks, playhead);
        if (!done) { done = true; opts.onDone?.(); }
        return true;
      }
      applySampled(opts.tracks, playhead);
      return false;
    },
  });

  // A paused entry's scale is zero, so `virtualNow` never advances and the
  // playhead holds at 0 until the consumer resumes.
  if (opts.autoplay === false) base.pause();

  return {
    ...base,
    seek(t) {
      offset = t - lastVirtual;
      playhead = t;
      prevPlayhead = t;
      recursor(opts.tracks, t);
    },
    time: () => playhead,
    duration: () => duration,
    tracks: () => opts.tracks,
    edit(fn) {
      fn();
      caches = new WeakMap();
      duration = tracksEnd(opts.tracks, opts.duration);
      for (const cb of subscribers) {
        try { cb(); } catch (err) { console.error('timeline: subscriber threw', err); }
      }
    },
    subscribe(cb) {
      subscribers.add(cb);
      return () => { subscribers.delete(cb); };
    },
  };
}
