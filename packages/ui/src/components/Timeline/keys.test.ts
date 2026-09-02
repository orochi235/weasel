import { describe, expect, it } from 'vitest';
import type { SampledTrack, Track } from '@weasel-js/core';
import { deleteKey, insertKey, moveKey, setKeyEasing, setKeyValue, snapTime } from './keys';

const track = (ts: number[]): Track => ({
  kind: 'sampled',
  label: 'x',
  keys: ts.map((t) => ({ t, value: t })),
  onTick: () => {},
}) as Track;

const times = (tracks: Track[], i = 0): number[] =>
  (tracks[i] as SampledTrack<number>).keys.map((k) => k.t);

describe('moveKey', () => {
  it('moves a key in time', () => {
    const r = moveKey([track([0, 100, 200])], { trackIndex: 0, keyIndex: 1 }, 150);
    expect(times(r.tracks)).toEqual([0, 150, 200]);
  });

  it('re-sorts when a key is dragged past its neighbour', () => {
    const r = moveKey([track([0, 100, 200])], { trackIndex: 0, keyIndex: 1 }, 250);
    expect(times(r.tracks)).toEqual([0, 200, 250]);
  });

  it('reports the moved key’s new index after a re-sort', () => {
    const r = moveKey([track([0, 100, 200])], { trackIndex: 0, keyIndex: 1 }, 250);
    expect(r.selection).toEqual({ trackIndex: 0, keyIndex: 2 });
  });

  it('clamps a negative time to zero', () => {
    const r = moveKey([track([0, 100])], { trackIndex: 0, keyIndex: 1 }, -50);
    expect(times(r.tracks)).toEqual([0, 0]);
  });

  it('does not mutate the input tracks', () => {
    const input = [track([0, 100, 200])];
    const before = times(input);
    moveKey(input, { trackIndex: 0, keyIndex: 1 }, 150);
    expect(times(input)).toEqual(before);
  });

  it('preserves the track’s callbacks by reference', () => {
    const input = [track([0, 100])];
    const r = moveKey(input, { trackIndex: 0, keyIndex: 1 }, 150);
    expect((r.tracks[0] as SampledTrack<number>).onTick)
      .toBe((input[0] as SampledTrack<number>).onTick);
  });

  it('moves an event track’s crossing', () => {
    const ev = { kind: 'event', label: 'step', events: [{ t: 10, fire: () => {} }] } as unknown as Track;
    const r = moveKey([ev], { trackIndex: 0, keyIndex: 0 }, 40);
    expect((r.tracks[0] as { events: { t: number }[] }).events[0].t).toBe(40);
  });

  it('leaves a nested timeline row alone', () => {
    const n = { kind: 'timeline', at: 0, timeline: { tracks: [] } } as unknown as Track;
    const r = moveKey([n], { trackIndex: 0, keyIndex: 0 }, 40);
    expect(r.tracks[0]).toBe(n);
  });
});

describe('insertKey', () => {
  it('inserts in sorted position', () => {
    const r = insertKey([track([0, 200])], 0, 100);
    expect(times(r.tracks)).toEqual([0, 100, 200]);
  });

  it('selects the inserted key', () => {
    const r = insertKey([track([0, 200])], 0, 100);
    expect(r.selection).toEqual({ trackIndex: 0, keyIndex: 1 });
  });

  it('seeds the new key with the track’s value at that time', () => {
    const r = insertKey([track([0, 200])], 0, 100);
    expect((r.tracks[0] as SampledTrack<number>).keys[1].value).toBeCloseTo(100, 6);
  });

  it('inserts into an empty track', () => {
    const r = insertKey([track([])], 0, 50);
    expect(times(r.tracks)).toEqual([50]);
  });
});

describe('deleteKey', () => {
  it('removes the key', () => {
    const r = deleteKey([track([0, 100, 200])], { trackIndex: 0, keyIndex: 1 });
    expect(times(r.tracks)).toEqual([0, 200]);
  });

  it('selects the previous key', () => {
    const r = deleteKey([track([0, 100, 200])], { trackIndex: 0, keyIndex: 1 });
    expect(r.selection).toEqual({ trackIndex: 0, keyIndex: 0 });
  });

  it('clears the selection when the last key goes', () => {
    const r = deleteKey([track([0])], { trackIndex: 0, keyIndex: 0 });
    expect(r.selection).toBeNull();
  });
});

describe('setKeyEasing', () => {
  it('writes a named easing', () => {
    const r = setKeyEasing([track([0, 100])], { trackIndex: 0, keyIndex: 1 }, 'easeOutBack');
    expect((r[0] as SampledTrack<number>).keys[1].easing).toBe('easeOutBack');
  });

  it('writes bezier control points', () => {
    const spec = { bezier: [0.4, 0, 0.2, 1] } as const;
    const r = setKeyEasing([track([0, 100])], { trackIndex: 0, keyIndex: 1 }, spec);
    expect((r[0] as SampledTrack<number>).keys[1].easing).toEqual(spec);
  });

  it('clears easing when given undefined', () => {
    let r = setKeyEasing([track([0, 100])], { trackIndex: 0, keyIndex: 1 }, 'easeOutBack');
    r = setKeyEasing(r, { trackIndex: 0, keyIndex: 1 }, undefined);
    expect((r[0] as SampledTrack<number>).keys[1].easing).toBeUndefined();
  });
});

describe('setKeyValue', () => {
  it('writes the value without moving the key', () => {
    const r = setKeyValue([track([0, 100])], { trackIndex: 0, keyIndex: 1 }, 42);
    expect((r[0] as SampledTrack<number>).keys[1]).toMatchObject({ t: 100, value: 42 });
  });
});

describe('snapTime', () => {
  it('snaps to a candidate inside the tolerance', () => {
    expect(snapTime(103, [0, 100, 200], 6)).toBe(100);
  });

  it('leaves a time outside the tolerance alone', () => {
    expect(snapTime(150, [0, 100, 200], 6)).toBe(150);
  });

  it('picks the nearest of two candidates in range', () => {
    expect(snapTime(98, [95, 100], 6)).toBe(100);
  });

  it('returns the time unchanged with no candidates', () => {
    expect(snapTime(150, [], 6)).toBe(150);
  });
});
