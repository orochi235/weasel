import type { Target } from '../target';
import { sampleTrack } from './sampleTrack';
import type { SampledTrack, Track } from './types';

/** A targeted track's voice on its target. */
export interface TrackHold {
  /** Says the track's value changed since the frame read it. */
  touch(): void;
  /** Takes the voice off, committing what the target was showing when `commit`. */
  leave(commit: boolean): void;
}

/** How a timeline holds a target: the animator's seam, so a timeline knows nothing of voices. */
export type OpenTrackHold = (
  target: Target<unknown>,
  value: () => unknown,
  weight: () => number,
  axes?: readonly (number | string)[],
  /** True where `weight` answers the same throughout: the hold is then read only when touched. */
  fixed?: boolean,
) => TrackHold;

/** A timeline's sampled tracks: sampled at the playhead, and held on the targets they name. */
export interface TrackSampler {
  /** Samples every sampled track at `t`, at any depth. */
  apply(tracks: Track[], t: number): void;
  /** After an edit: what sampling built from the keys is stale. */
  edited(): void;
  /** Lets go of every target, each committing what it was showing. */
  release(): void;
}

interface Held {
  hold: TrackHold | null;
  value: unknown;
  /** Where the playhead last stood against the track's keys. */
  where: 'before' | 'inside' | 'after' | null;
  t: number;
  edit: number;
  pass: number;
}

export function createTrackSampler(open?: OpenTrackHold): TrackSampler {
  // Per-sampled-track sampling caches, dropped wholesale by `edited`.
  let caches = new WeakMap<object, Map<number, (u: number) => unknown>>();
  const cacheFor = (track: object): Map<number, (u: number) => unknown> => {
    let c = caches.get(track);
    if (!c) { c = new Map(); caches.set(track, c); }
    return c;
  };
  const held = new Map<SampledTrack<unknown>, Held>();
  let edit = 0;
  let pass = 0;

  const openOn = (st: SampledTrack<unknown>, h: Held): TrackHold => {
    if (!open) throw new Error('timeline: a track with a `target` needs a timeline made by an animator');
    const w = st.weight ?? 1;
    return typeof w === 'function'
      ? open(st.target!, () => h.value, w, st.axes)
      : open(st.target!, () => h.value, () => w, st.axes, true);
  };

  const place = (st: SampledTrack<unknown>, value: unknown, t: number): void => {
    let h = held.get(st);
    if (!h) held.set(st, h = { hold: null, value, where: null, t, edit, pass });
    const moved = h.t !== t || h.edit !== edit;
    h.value = value;
    h.t = t;
    h.edit = edit;
    h.pass = pass;
    const { keys } = st;
    const where = t < keys[0].t ? 'before' : t > keys[keys.length - 1].t ? 'after' : 'inside';
    if (where === 'inside') {
      if (!h.hold) h.hold = openOn(st, h);
      else if (moved) h.hold.touch();
    } else if (where === 'before') {
      h.hold?.leave(false);
      h.hold = null;
    } else if (h.where !== 'after') {
      // Past its last key the move is made: the target keeps it, and is free for others to move.
      (h.hold ?? openOn(st, h)).leave(true);
      h.hold = null;
    }
    h.where = where;
  };

  const visit = (tracks: Track[], t: number): void => {
    for (const track of tracks) {
      if (track.kind === 'sampled') {
        const st = track as SampledTrack<unknown>;
        const v = sampleTrack(st, t, cacheFor(st));
        if (v === undefined) continue;
        if (st.target) place(st, v, t);
        st.onTick?.(v);
      } else if (track.kind === 'timeline') {
        visit(track.timeline.tracks, t - track.at);
      }
    }
  };

  return {
    apply(tracks, t) {
      pass += 1;
      visit(tracks, t);
      // A track an edit took out of the timeline, or emptied, was not sampled this pass.
      for (const [st, h] of held) {
        if (h.pass === pass) continue;
        h.hold?.leave(true);
        held.delete(st);
      }
    },
    edited() {
      caches = new WeakMap();
      edit += 1;
    },
    release() {
      for (const h of held.values()) {
        if (!h.hold) continue;
        h.hold.leave(true);
        h.hold = null;
        h.where = null;
      }
    },
  };
}
