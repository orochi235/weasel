import { sampleTrack, type EasingSpec, type EventTrack, type Keyframe, type SampledTrack, type Track } from '@weasel-js/core';

export interface KeySelection {
  trackIndex: number;
  keyIndex: number;
}

export interface KeyEdit {
  tracks: Track[];
  selection: KeySelection | null;
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

function replaceAt(tracks: readonly Track[], index: number, next: Track): Track[] {
  const out = tracks.slice();
  out[index] = next;
  return out;
}

/** Move a key or an event crossing to `toMs`, clamped at zero.
 *
 *  Re-sorts, and reports the moved entry's new index. `sampleTrack` binary-
 *  searches without sorting first, so a drag past a neighbour that left the list
 *  unsorted would sample the wrong segment and raise nothing. */
export function moveKey(
  tracks: readonly Track[], sel: KeySelection, toMs: number,
): KeyEdit {
  const track = tracks[sel.trackIndex];
  const t = Math.max(0, toMs);

  if (track?.kind === 'sampled') {
    const st = track as SampledTrack<unknown>;
    const moved = { ...st.keys[sel.keyIndex], t };
    const keys = st.keys.filter((_, i) => i !== sel.keyIndex);
    const at = keys.findIndex((k) => k.t > t);
    const keyIndex = at === -1 ? keys.length : at;
    keys.splice(keyIndex, 0, moved);
    return {
      tracks: replaceAt(tracks, sel.trackIndex, withKeys(track, keys)),
      selection: { trackIndex: sel.trackIndex, keyIndex },
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
      tracks: replaceAt(tracks, sel.trackIndex, withEvents(track, events)),
      selection: { trackIndex: sel.trackIndex, keyIndex },
    };
  }

  return { tracks: tracks.slice(), selection: sel };
}

/** Insert a key at `atMs`, seeded with whatever the track already reads there
 *  so inserting alone never changes the motion. */
export function insertKey(
  tracks: readonly Track[], trackIndex: number, atMs: number,
): KeyEdit {
  const track = tracks[trackIndex];
  if (track?.kind !== 'sampled') return { tracks: tracks.slice(), selection: null };

  const st = track as SampledTrack<unknown>;
  const t = Math.max(0, atMs);
  const value = st.keys.length === 0 ? 0 : sampleTrack(st, t);
  const keys = st.keys.slice();
  const at = keys.findIndex((k) => k.t > t);
  const keyIndex = at === -1 ? keys.length : at;
  keys.splice(keyIndex, 0, { t, value });
  return {
    tracks: replaceAt(tracks, trackIndex, withKeys(track, keys)),
    selection: { trackIndex, keyIndex },
  };
}

/** Remove a key, selecting the one before it. */
export function deleteKey(tracks: readonly Track[], sel: KeySelection): KeyEdit {
  const track = tracks[sel.trackIndex];
  if (track?.kind !== 'sampled') return { tracks: tracks.slice(), selection: sel };

  const st = track as SampledTrack<unknown>;
  const keys = st.keys.filter((_, i) => i !== sel.keyIndex);
  return {
    tracks: replaceAt(tracks, sel.trackIndex, withKeys(track, keys)),
    selection: keys.length === 0
      ? null
      : { trackIndex: sel.trackIndex, keyIndex: Math.max(0, sel.keyIndex - 1) },
  };
}

/** Set the easing shaping the approach INTO the selected key. */
export function setKeyEasing(
  tracks: readonly Track[], sel: KeySelection, easing: EasingSpec | undefined,
): Track[] {
  const track = tracks[sel.trackIndex];
  if (track?.kind !== 'sampled') return tracks.slice();

  const st = track as SampledTrack<unknown>;
  const keys = st.keys.slice();
  const { easing: _drop, ...rest } = keys[sel.keyIndex];
  keys[sel.keyIndex] = easing === undefined ? rest : { ...rest, easing };
  return replaceAt(tracks, sel.trackIndex, withKeys(track, keys));
}

/** Set the selected key's value, leaving its time alone. */
export function setKeyValue(
  tracks: readonly Track[], sel: KeySelection, value: unknown,
): Track[] {
  const track = tracks[sel.trackIndex];
  if (track?.kind !== 'sampled') return tracks.slice();

  const st = track as SampledTrack<unknown>;
  const keys = st.keys.slice();
  keys[sel.keyIndex] = { ...keys[sel.keyIndex], value };
  return replaceAt(tracks, sel.trackIndex, withKeys(track, keys));
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
