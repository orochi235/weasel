import { describe, expect, it, vi } from 'vitest';
import { sampleTrack } from './sampleTrack';
import type { SampledTrack } from './types';

const track = (keys: { t: number; value: number; easing?: (t: number) => number }[]): SampledTrack<number> => ({
  kind: 'sampled',
  keys,
  onTick: () => {},
});

describe('sampleTrack', () => {
  it('holds the first value before the first key', () => {
    expect(sampleTrack(track([{ t: 100, value: 5 }, { t: 200, value: 9 }]), 0)).toBe(5);
  });

  it('holds the last value after the last key', () => {
    expect(sampleTrack(track([{ t: 100, value: 5 }, { t: 200, value: 9 }]), 999)).toBe(9);
  });

  it('lerps linearly between two keys', () => {
    expect(sampleTrack(track([{ t: 0, value: 0 }, { t: 100, value: 10 }]), 50)).toBe(5);
  });

  it('applies the LATER key easing, not the earlier one', () => {
    const t = track([
      { t: 0, value: 0, easing: () => 0 },
      { t: 100, value: 10, easing: () => 1 },
    ]);
    expect(sampleTrack(t, 50)).toBe(10);
  });

  it('returns an exact key value at that key time', () => {
    expect(sampleTrack(track([{ t: 0, value: 3 }, { t: 100, value: 7 }]), 100)).toBe(7);
  });

  it('returns undefined for an empty track', () => {
    expect(sampleTrack(track([]), 10)).toBeUndefined();
  });

  it('uses a custom interpolate for non-numeric values', () => {
    const t: SampledTrack<string> = {
      kind: 'sampled',
      keys: [{ t: 0, value: 'a' }, { t: 100, value: 'b' }],
      interpolate: (a, b, u) => (u < 0.5 ? a : b),
      onTick: () => {},
    };
    expect(sampleTrack(t, 10)).toBe('a');
    expect(sampleTrack(t, 90)).toBe('b');
  });

  it('builds an interpolator factory once per segment, not per sample', () => {
    const build = vi.fn((a: number, b: number) => (u: number) => a + (b - a) * u);
    const t: SampledTrack<number> = {
      kind: 'sampled',
      keys: [{ t: 0, value: 0 }, { t: 100, value: 10 }],
      interpolator: build,
      onTick: () => {},
    };
    const cache = new Map<number, (u: number) => number>();
    sampleTrack(t, 10, cache);
    sampleTrack(t, 20, cache);
    sampleTrack(t, 30, cache);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('throws for non-numeric values with no interpolate', () => {
    const t = {
      kind: 'sampled',
      keys: [{ t: 0, value: 'a' }, { t: 100, value: 'b' }],
      onTick: () => {},
    } as unknown as SampledTrack<string>;
    expect(() => sampleTrack(t, 50)).toThrow(/interpolate/);
  });
});
