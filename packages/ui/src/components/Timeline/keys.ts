import { sampleTrack, type EasingSpec, type EventTrack, type Keyframe, type SampledTrack, type TimelineTrack, type Track } from '@weasel-js/core';
import { trackAtPath } from './lanes';

export interface KeySelection {
  /** Index path into the track tree, outermost first — a `LaneRow.path`. A
   *  top-level track is `[i]`; a track inside the nested timeline at `i` is
   *  `[i, j]`. */
  trackPath: readonly number[];
  keyIndex: number;
}

export interface KeyEdit {
  tracks: Track[];
  selection: KeySelection | null;
}

/** True when two index paths address the same track. */
export function samePath(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

/** Shallow-clone one track, replacing only its key list. `onTick`, `fire`,
 *  `interpolate` and `interpolator` survive as references, which is what lets a
 *  running timeline take an edited track without rewiring. */
function withKeys(track: Track, keys: Keyframe<unknown>[]): Track {
  return { ...(track as SampledTrack<unknown>), keys } as Track;
}

function withEvents(track: Track, events: EventTrack['events']): Track {
  return { ...(track as EventTrack), events } as Track;
}

/** Replace the track at `path`, cloning the timeline tracks along the way so
 *  the caller's tree is untouched at every level, not just the top. */
function replaceAtPath(tracks: readonly Track[], path: readonly number[], next: Track): Track[] {
  const out = tracks.slice();
  const [i, ...rest] = path;
  if (rest.length === 0) {
    out[i] = next;
    return out;
  }
  const parent = out[i];
  if (parent?.kind !== 'timeline') return out;
  const tt = parent as TimelineTrack;
  out[i] = {
    ...tt,
    timeline: { ...tt.timeline, tracks: replaceAtPath(tt.timeline.tracks, rest, next) },
  };
  return out;
}

/** Move a key or an event crossing to `toMs`, clamped at zero. `toMs` is in the
 *  addressed track's own time, not the ruler's — a nested track's keys are
 *  measured from its parent's `at`.
 *
 *  Re-sorts, and reports the moved entry's new index. `sampleTrack` binary-
 *  searches without sorting first, so a drag past a neighbour that left the list
 *  unsorted would sample the wrong segment and raise nothing. */
export function moveKey(
  tracks: readonly Track[], sel: KeySelection, toMs: number,
): KeyEdit {
  const track = trackAtPath(tracks, sel.trackPath);
  const t = Math.max(0, toMs);

  if (track?.kind === 'sampled') {
    const st = track as SampledTrack<unknown>;
    const moved = { ...st.keys[sel.keyIndex], t };
    const keys = st.keys.filter((_, i) => i !== sel.keyIndex);
    const at = keys.findIndex((k) => k.t > t);
    const keyIndex = at === -1 ? keys.length : at;
    keys.splice(keyIndex, 0, moved);
    return {
      tracks: replaceAtPath(tracks, sel.trackPath, withKeys(track, keys)),
      selection: { trackPath: sel.trackPath, keyIndex },
    };
  }

  if (track?.kind === 'event') {
    const et = track as EventTrack;
    const moved = { ...et.events[sel.keyIndex], t };
    const events = et.events.filter((_, i) => i !== sel.keyIndex);
    const at = events.findIndex((e) => e.t > t);
    const keyIndex = at === -1 ? events.length : at;
    events.splice(keyIndex, 0, moved);
    return {
      tracks: replaceAtPath(tracks, sel.trackPath, withEvents(track, events)),
      selection: { trackPath: sel.trackPath, keyIndex },
    };
  }

  return { tracks: tracks.slice(), selection: sel };
}

/** Insert a key at `atMs`, seeded with whatever the track already reads there
 *  so inserting alone never changes the motion. */
export function insertKey(
  tracks: readonly Track[], trackPath: readonly number[], atMs: number,
): KeyEdit {
  const track = trackAtPath(tracks, trackPath);
  if (track?.kind !== 'sampled') return { tracks: tracks.slice(), selection: null };

  const st = track as SampledTrack<unknown>;
  const t = Math.max(0, atMs);
  const value = st.keys.length === 0 ? 0 : sampleTrack(st, t);
  const keys = st.keys.slice();
  const at = keys.findIndex((k) => k.t > t);
  const keyIndex = at === -1 ? keys.length : at;
  keys.splice(keyIndex, 0, { t, value });
  return {
    tracks: replaceAtPath(tracks, trackPath, withKeys(track, keys)),
    selection: { trackPath, keyIndex },
  };
}

/** Remove a key, selecting the one before it. */
export function deleteKey(tracks: readonly Track[], sel: KeySelection): KeyEdit {
  const track = trackAtPath(tracks, sel.trackPath);
  if (track?.kind !== 'sampled') return { tracks: tracks.slice(), selection: sel };

  const st = track as SampledTrack<unknown>;
  const keys = st.keys.filter((_, i) => i !== sel.keyIndex);
  return {
    tracks: replaceAtPath(tracks, sel.trackPath, withKeys(track, keys)),
    selection: keys.length === 0
      ? null
      : { trackPath: sel.trackPath, keyIndex: Math.max(0, sel.keyIndex - 1) },
  };
}

/** Set the easing shaping the approach INTO the selected key. */
export function setKeyEasing(
  tracks: readonly Track[], sel: KeySelection, easing: EasingSpec | undefined,
): Track[] {
  const track = trackAtPath(tracks, sel.trackPath);
  if (track?.kind !== 'sampled') return tracks.slice();

  const st = track as SampledTrack<unknown>;
  const keys = st.keys.slice();
  const { easing: _drop, ...rest } = keys[sel.keyIndex];
  keys[sel.keyIndex] = easing === undefined ? rest : { ...rest, easing };
  return replaceAtPath(tracks, sel.trackPath, withKeys(track, keys));
}

/** Set the selected key's value, leaving its time alone. */
export function setKeyValue(
  tracks: readonly Track[], sel: KeySelection, value: unknown,
): Track[] {
  const track = trackAtPath(tracks, sel.trackPath);
  if (track?.kind !== 'sampled') return tracks.slice();

  const st = track as SampledTrack<unknown>;
  const keys = st.keys.slice();
  keys[sel.keyIndex] = { ...keys[sel.keyIndex], value };
  return replaceAtPath(tracks, sel.trackPath, withKeys(track, keys));
}

/** Snap `ms` to the nearest candidate within `toleranceMs`, else return it. */
export function snapTime(ms: number, candidates: readonly number[], toleranceMs: number): number {
  let best = ms;
  let bestDist = toleranceMs;
  for (const c of candidates) {
    const d = Math.abs(c - ms);
    if (d <= bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}
