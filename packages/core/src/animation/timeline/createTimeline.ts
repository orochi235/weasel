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
  let done = false;

  // Per-sampled-track interpolator-factory caches, dropped whenever `edit`
  // bumps the version. Without this an edited keyframe keeps interpolating
  // toward its old value with no visible error.
  let caches = new WeakMap<object, Map<number, (u: number) => unknown>>();
  const cacheFor = (track: object): Map<number, (u: number) => unknown> => {
    let c = caches.get(track);
    if (!c) { c = new Map(); caches.set(track, c); }
    return c;
  };

  const applySampled = (tracks: Track[], t: number): void => {
    for (const track of tracks) {
      if (track.kind !== 'sampled') continue;
      const st = track as SampledTrack<unknown>;
      const v = sampleTrack(st, t, cacheFor(st) as Map<number, (u: number) => unknown>);
      if (v !== undefined) st.onTick(v);
    }
  };

  const base = register({
    id,
    cancelKey: opts.cancelKey,
    tick(virtualNow) {
      lastVirtual = virtualNow;
      playhead = virtualNow + offset;
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

  return {
    ...base,
    seek(t) {
      offset = t - lastVirtual;
      playhead = t;
    },
    time: () => playhead,
    duration: () => duration,
    tracks: () => opts.tracks,
    edit(fn) {
      fn();
      caches = new WeakMap();
      duration = tracksEnd(opts.tracks, opts.duration);
    },
    subscribe: () => () => {},
  };
}
