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
  it('takes the later of two keys sharing a time, at exactly that time', () => {
    const t = track([{ t: 0, value: 0 }, { t: 50, value: 10 }, { t: 50, value: 20 }, { t: 100, value: 30 }]);
    expect(sampleTrack(t, 50)).toBe(20);
    expect(sampleTrack(t, 25)).toBe(5);
    expect(sampleTrack(t, 75)).toBe(25);
  });

  it('returns an interior key value exactly, with no float drift', () => {
    // 0.7 + (0.1 - 0.7) * 1 is 0.09999999999999998.
    const t = track([{ t: 0, value: 0.7 }, { t: 100, value: 0.1 }, { t: 200, value: 0.5 }]);
    expect(sampleTrack(t, 100)).toBe(0.1);
  });

  it('returns an interior key value even under an easing that overshoots its end', () => {
    const t = track([{ t: 0, value: 0 }, { t: 100, value: 10, easing: (u) => u * 2 }, { t: 200, value: 0 }]);
    expect(sampleTrack(t, 100)).toBe(10);
  });

  it('holds the first value before, and the last at or after, keys that all share one time', () => {
    const t = track([{ t: 100, value: 1 }, { t: 100, value: 2 }]);
    expect(sampleTrack(t, 50)).toBe(1);
    expect(sampleTrack(t, 100)).toBe(2);
    expect(sampleTrack(t, 150)).toBe(2);
  });

  it('returns a single key value at any time', () => {
    const t = track([{ t: 100, value: 4 }]);
    expect(sampleTrack(t, 0)).toBe(4);
    expect(sampleTrack(t, 500)).toBe(4);
  });

  it('lerps a number array with no interpolate', () => {
    const t: SampledTrack<number[]> = {
      kind: 'sampled', keys: [{ t: 0, value: [0, 0] }, { t: 100, value: [10, 20] }], onTick: () => {},
    };
    expect(sampleTrack(t, 50)).toEqual([5, 10]);
  });

  it('lerps a numeric object with no interpolate', () => {
    const t: SampledTrack<{ x: number; y: number }> = {
      kind: 'sampled', keys: [{ t: 0, value: { x: 0, y: 0 } }, { t: 100, value: { x: 10, y: 20 } }], onTick: () => {},
    };
    expect(sampleTrack(t, 50)).toEqual({ x: 5, y: 10 });
  });

  it('throws for keys whose numeric shapes differ', () => {
    const t = {
      kind: 'sampled', keys: [{ t: 0, value: [0, 0] }, { t: 100, value: [1, 2, 3] }], onTick: () => {},
    } as SampledTrack<number[]>;
    expect(() => sampleTrack(t, 50)).toThrow(/shape/);
  });

  it('sees replaced keys on the next call when no cache is passed', () => {
    const t = track([{ t: 0, value: 0 }, { t: 100, value: 10 }]);
    expect(sampleTrack(t, 50)).toBe(5);
    t.keys = [{ t: 0, value: 0 }, { t: 100, value: 100 }];
    expect(sampleTrack(t, 50)).toBe(50);
  });

  it('rebuilds once a dropped cache is replaced by a fresh one', () => {
    const build = vi.fn((a: number, b: number) => (u: number) => a + (b - a) * u);
    const t: SampledTrack<number> = {
      kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 100, value: 10 }], interpolator: build, onTick: () => {},
    };
    sampleTrack(t, 10, new Map());
    t.keys[1].value = 1000;
    expect(sampleTrack(t, 50, new Map())).toBe(500);
    expect(build).toHaveBeenCalledTimes(2);
  });
  it('keeps two tracks apart when they share one cache', () => {
    const cache = new Map<number, (u: number) => number>();
    const a = track([{ t: 0, value: 0 }, { t: 100, value: 10 }]);
    const b = track([{ t: 0, value: 0 }, { t: 100, value: 1000 }]);
    expect([sampleTrack(a, 50, cache), sampleTrack(b, 50, cache)]).toEqual([5, 500]);
  });

  it('sees replaced keys on the next call through the same cache', () => {
    const cache = new Map<number, (u: number) => number>();
    const t = track([{ t: 0, value: 0 }, { t: 100, value: 10 }]);
    expect(sampleTrack(t, 50, cache)).toBe(5);
    t.keys = [{ t: 0, value: 0 }, { t: 100, value: 100 }];
    expect(sampleTrack(t, 50, cache)).toBe(50);
  });

  it('reads a non-numeric track with no interpolate at and beyond its keys, throwing only between them', () => {
    const t = {
      kind: 'sampled', keys: [{ t: 0, value: 'a' }, { t: 100, value: 'b' }], onTick: () => {},
    } as unknown as SampledTrack<string>;
    expect(sampleTrack(t, -10)).toBe('a');
    expect(sampleTrack(t, 0)).toBe('a');
    expect(sampleTrack(t, 100)).toBe('b');
    expect(sampleTrack(t, 200)).toBe('b');
    expect(() => sampleTrack(t, 50)).toThrow(/interpolate/);
  });
});
