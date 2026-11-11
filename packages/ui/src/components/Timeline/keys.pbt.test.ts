/**
 * Property tests of the timeline's key edits on random trees of sampled, event, and nested timeline tracks: a
 * move keeps the keys sorted and selects the key it moved, an insert leaves the motion as it was, a delete
 * selects the key before, and every edit leaves the caller's tree untouched and every other track as it was.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { sampleTrack, type EventTrack, type SampledTrack, type Track } from '@weasel-js/animator';
import { runs, tally, timeoutFor, uniform } from '../../pbt.fixture';
import { deleteKey, insertKey, moveKey, setKeyEasing } from './keys';
import { trackAtPath } from './lanes';

const RUNS = 200;

const time = fc.oneof(fc.integer({ min: 0, max: 1000 }), fc.constantFrom(0, 100, 500));
const sorted = (ts: number[]) => [...ts].sort((a, b) => a - b);

const sampled = (eased: boolean): fc.Arbitrary<Track> => fc.array(fc.tuple(time, uniform(-100, 100), fc.constantFrom('easeInQuad', 'easeOutCubic', 'linear')), { minLength: 0, maxLength: 6 })
  .map((ks) => {
    const ts = sorted(ks.map((k) => k[0]));
    return {
      kind: 'sampled', label: 's', onTick: () => {},
      keys: ks.map(([, value, easing], i) => ({ t: ts[i]!, value, ...(eased && i % 2 === 1 ? { easing } : {}) })),
    } as Track;
  });
const event: fc.Arbitrary<Track> = fc.array(time, { maxLength: 5 }).map((ts) => ({
  kind: 'event', label: 'e', events: sorted(ts).map((t, i) => ({ t, fire: () => {}, id: i })),
}) as unknown as Track);

const tree = (eased: boolean): fc.Arbitrary<Track[]> => fc.letrec<{ list: Track[]; track: Track }>((tie) => ({
  track: fc.oneof({ depthSize: 'small' },
    { arbitrary: sampled(eased), weight: 4 },
    { arbitrary: event, weight: 1 },
    { arbitrary: fc.tuple(time, tie('list')).map(([at, tracks]) => ({ kind: 'timeline', at, timeline: { tracks } }) as unknown as Track), weight: 1 }),
  list: fc.array(tie('track'), { minLength: 1, maxLength: 3 }),
})).list;

/** Every index path to a track holding keys or events. */
function pathsOf(tracks: readonly Track[], at: number[] = []): number[][] {
  return tracks.flatMap((t, i) => {
    const p = [...at, i];
    if (t.kind === 'timeline') return pathsOf((t as unknown as { timeline: { tracks: Track[] } }).timeline.tracks, p);
    return [p];
  });
}

const entries = (t: Track | undefined): { t: number }[] =>
  t?.kind === 'sampled' ? (t as SampledTrack<unknown>).keys : t?.kind === 'event' ? (t as EventTrack).events : [];

/** A tree, one of its keyed tracks, and an entry on it, where it has one. */
const pick = (eased: boolean) => tree(eased).chain((tracks) => {
  const paths = pathsOf(tracks);
  return fc.record({
    tracks: fc.constant(tracks),
    path: fc.constantFrom(...paths),
    k: fc.nat(),
    to: fc.oneof(fc.integer({ min: -100, max: 1200 }), fc.constantFrom(0, 100, 500)),
  });
}).map((p) => ({ ...p, keyIndex: entries(trackAtPath(p.tracks, p.path)).length === 0 ? -1 : p.k % entries(trackAtPath(p.tracks, p.path)).length }));

/** The whole tree as JSON, functions dropped: the caller's copy, to see that no edit wrote into it. */
const snap = (tracks: readonly Track[]) => JSON.stringify(tracks);

/** Every track other than the one at `path` is the same object, and every timeline above it is a copy. */
function othersKept(before: readonly Track[], after: readonly Track[], path: readonly number[]): void {
  for (const p of pathsOf(before)) {
    if (p.join('.') === path.join('.')) continue;
    expect(trackAtPath(after, p)).toBe(trackAtPath(before, p));
  }
}

describe('moveKey', () => {
  it('keeps the entries sorted and selects the one it moved, at its new time', () => {
    const t = tally();
    fc.assert(fc.property(pick(true), ({ tracks, path, keyIndex, to }) => {
      fc.pre(keyIndex >= 0);
      const was = snap(tracks);
      const before = entries(trackAtPath(tracks, path));
      const moved = before[keyIndex]!;
      const r = moveKey(tracks, { trackPath: path, keyIndex }, to);
      expect(snap(tracks)).toBe(was);
      const after = entries(trackAtPath(r.tracks, path));
      expect(after).toHaveLength(before.length);
      for (let i = 1; i < after.length; i++) expect(after[i]!.t).toBeGreaterThanOrEqual(after[i - 1]!.t);
      const at = r.selection!.keyIndex;
      expect(r.selection!.trackPath).toEqual(path);
      expect(after[at]).toEqual({ ...moved, t: Math.max(0, to) });
      expect(after.filter((_, i) => i !== at)).toEqual(before.filter((_, i) => i !== keyIndex));
      if (at !== keyIndex) t.count('reordered');
      if (path.length > 1) t.count('nested');
      t.count(trackAtPath(tracks, path)!.kind);
      othersKept(tracks, r.tracks, path);
    }), runs(RUNS));
    for (const k of ['reordered', 'nested', 'sampled', 'event']) t.atLeast(k, 15);
  }, timeoutFor(RUNS, 3));
});

describe('insertKey', () => {
  it('adds a key where the track already reads, leaving its linear motion as it was', () => {
    const t = tally();
    fc.assert(fc.property(pick(false), uniform(-50, 1100), ({ tracks, path }, at) => {
      const track = trackAtPath(tracks, path)!;
      const r = insertKey(tracks, path, at);
      if (track.kind !== 'sampled') { expect(r.selection).toBeNull(); return; }
      const before = track as SampledTrack<number>;
      const after = trackAtPath(r.tracks, path) as SampledTrack<number>;
      expect(after.keys).toHaveLength(before.keys.length + 1);
      expect(after.keys[r.selection!.keyIndex]!.t).toBe(Math.max(0, at));
      othersKept(tracks, r.tracks, path);
      if (before.keys.length === 0) { t.count('first'); return; }
      t.count('inserted');
      for (let x = -50; x <= 1150; x += 25) {
        expect(sampleTrack(after, x)).toBeCloseTo(sampleTrack(before, x)!, 6);
      }
    }), runs(RUNS));
    t.atLeast('first', 10);
    t.atLeast('inserted', 50);
  }, timeoutFor(RUNS, 5));
});

describe('deleteKey and setKeyEasing', () => {
  it('delete one key and select the one before it; easing set and cleared leaves the key as it was', () => {
    const t = tally();
    fc.assert(fc.property(pick(true), fc.constantFrom('easeInQuad', 'easeOutBack', 'linear'), ({ tracks, path, keyIndex }, easing) => {
      fc.pre(keyIndex >= 0);
      const track = trackAtPath(tracks, path)!;
      const was = snap(tracks);
      const r = deleteKey(tracks, { trackPath: path, keyIndex });
      expect(snap(tracks)).toBe(was);
      if (track.kind !== 'sampled') { expect(r.tracks).toEqual(tracks); return; }
      const keys = (track as SampledTrack<number>).keys;
      const after = (trackAtPath(r.tracks, path) as SampledTrack<number>).keys;
      expect(after).toEqual(keys.filter((_, i) => i !== keyIndex));
      if (after.length === 0) { expect(r.selection).toBeNull(); t.count('emptied'); }
      else { expect(r.selection).toEqual({ trackPath: path, keyIndex: Math.max(0, keyIndex - 1) }); t.count('deleted'); }
      othersKept(tracks, r.tracks, path);
      const eased = setKeyEasing(tracks, { trackPath: path, keyIndex }, easing);
      expect((trackAtPath(eased, path) as SampledTrack<number>).keys[keyIndex]!.easing).toBe(easing);
      const cleared = setKeyEasing(eased, { trackPath: path, keyIndex }, undefined);
      const { easing: _drop, ...plain } = keys[keyIndex]!;
      expect((trackAtPath(cleared, path) as SampledTrack<number>).keys[keyIndex]).toEqual(plain);
    }), runs(RUNS));
    t.atLeast('emptied', 10);
    t.atLeast('deleted', 30);
  }, timeoutFor(RUNS, 3));
});

describe('insertKey, shrunk', () => {
  it('runs an eased stretch’s easing again over each side of the new key', () => {
    const tr = { kind: 'sampled', onTick: () => {}, keys: [{ t: 0, value: 0 }, { t: 100, value: 100, easing: 'easeInQuad' }] } as unknown as Track;
    const after = insertKey([tr], [0], 50).tracks[0] as SampledTrack<number>;
    expect(after.keys[1]).toEqual({ t: 50, value: 25 });
    expect(sampleTrack(tr as SampledTrack<number>, 75)).toBeCloseTo(56.25, 9);
    expect(sampleTrack(after, 75)).toBeCloseTo(43.75, 9);
  });
});
