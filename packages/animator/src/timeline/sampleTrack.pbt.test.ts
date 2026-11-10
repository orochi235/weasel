import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { sampleTrack } from './sampleTrack';
import type { Keyframe, SampledTrack } from './types';
import { runs, tally } from '../pbt.fixture';

const RUNS = runs(300);

const value = fc.oneof(fc.double({ min: -1e4, max: 1e4, noNaN: true }), fc.integer({ min: -10, max: 10 }));
const easing = fc.constantFrom(undefined, 'linear' as const, 'easeInOutQuad' as const, 'easeOutCubic' as const);

/** A time on a tenth-of-a-millisecond grid: a key and a sample a few ulps apart round onto one
 *  place in the track's 0..1 span, which says nothing about the track. */
const grid = fc.oneof(fc.integer({ min: 0, max: 20 }).map((n) => n * 50), fc.integer({ min: -1000, max: 10_000 }).map((n) => n / 10));

/** Keys sorted by time, often sharing one. */
const keys: fc.Arbitrary<Keyframe<number>[]> = fc.array(
  fc.record({ t: grid, value, easing }),
  { minLength: 1, maxLength: 6 },
).map((ks) => ks.sort((a, b) => a.t - b.t).map(({ easing: e, ...k }) => (e === undefined ? k : { ...k, easing: e })));

const track = <T>(ks: Keyframe<T>[]): SampledTrack<T> => ({ kind: 'sampled', keys: ks });
const at = fc.oneof(grid, fc.integer({ min: -2000, max: 12_000 }).map((n) => n / 10 + 0.05));

describe('sampleTrack, property', () => {
  it('answers each key time with the last key there, and the end keys outside them', () => {
    const t = tally();
    fc.assert(fc.property(keys, (ks) => {
      const tr = track(ks);
      for (const k of ks) {
        const last = ks.filter((o) => o.t === k.t).at(-1)!;
        expect(sampleTrack(tr, k.t)).toBe(last.value);
      }
      const first = ks[0]!, end = ks.at(-1)!;
      expect(sampleTrack(tr, first.t - 1)).toBe(first.value);
      expect(sampleTrack(tr, end.t + 1)).toBe(end.value);
      expect(sampleTrack(tr, Number.NaN)).toBe(first.value);
      if (ks.length > 1 && ks[0]!.t !== ks.at(-1)!.t) t.count('span');
    }), RUNS);
    t.atLeast('span', 20);
  });

  it('stays between the two keys around t, under an easing that does', () => {
    const t = tally();
    fc.assert(fc.property(keys, at, (ks, time) => {
      const v = sampleTrack(track(ks), time)!;
      expect(Number.isFinite(v)).toBe(true);
      const after = ks.findIndex((k) => k.t > time);
      if (after <= 0) return;
      const a = ks[after - 1]!.value, b = ks[after]!.value;
      const slack = 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
      expect(v).toBeGreaterThanOrEqual(Math.min(a, b) - slack);
      expect(v).toBeLessThanOrEqual(Math.max(a, b) + slack);
      t.count('between');
    }), RUNS);
    t.atLeast('between', 50);
  });

  it('is linear between keys with no easing', () => {
    fc.assert(fc.property(keys, at, (ks, time) => {
      const plain = ks.map(({ t, value: v }) => ({ t, value: v }));
      const after = plain.findIndex((k) => k.t > time);
      if (after <= 0 || plain[after - 1]!.t === time) return;
      const a = plain[after - 1]!, b = plain[after]!;
      const want = a.value + (b.value - a.value) * ((time - a.t) / (b.t - a.t));
      expect(sampleTrack(track(plain), time)).toBeCloseTo(want, 6);
    }), RUNS);
  });

  it('samples alike with a cache in any order and with none', () => {
    fc.assert(fc.property(keys, fc.array(at, { minLength: 1, maxLength: 20 }), (ks, times) => {
      const tr = track(ks);
      const cache = new Map<number, (u: number) => number>();
      for (const time of times) expect(sampleTrack(tr, time, cache)).toBe(sampleTrack(tr, time));
    }), RUNS);
  });

  it('samples a number, a one-number array, and a one-field object alike', () => {
    fc.assert(fc.property(keys, at, (ks, time) => {
      const n = sampleTrack(track(ks), time);
      const arr = sampleTrack(track(ks.map((k) => ({ ...k, value: [k.value] }))), time);
      const obj = sampleTrack(track(ks.map((k) => ({ ...k, value: { x: k.value } }))), time);
      expect(arr).toEqual([n]);
      expect(obj).toEqual({ x: n });
    }), RUNS);
  });

  it('samples keys moved later by c at t + c as the keys at t', () => {
    fc.assert(fc.property(keys, at, fc.integer({ min: -4, max: 4 }).map((n) => n * 256), (ks, time, c) => {
      const moved = ks.map((k) => ({ ...k, t: k.t + c }));
      const want = sampleTrack(track(ks), time)!;
      expect(sampleTrack(track(moved), time + c)).toBeCloseTo(want, 4);
    }), RUNS);
  });
});
