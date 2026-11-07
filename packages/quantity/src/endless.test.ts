import { describe, expect, it } from 'vitest';
import { endlessTrack } from './endless';

describe('endlessTrack', () => {
  it('puts the infinity stop a twentieth of the range out when there is no step', () => {
    const t = endlessTrack(0, 100, undefined, 'max');
    expect([t.min, t.max]).toEqual([0, 105]);
    expect(t.fromTrack(105)).toBe(Infinity);
    expect(t.fromTrack(101)).toBe(100);
  });

  it('keeps infinity reachable on a range with no width and no step', () => {
    const t = endlessTrack(5, 5, undefined, 'both');
    expect(t.max).toBeGreaterThan(5);
    expect(t.min).toBeLessThan(5);
    expect(t.fromTrack(t.toTrack(Infinity))).toBe(Infinity);
    expect(t.fromTrack(t.toTrack(-Infinity))).toBe(-Infinity);
    expect(t.fromTrack(5)).toBe(5);
  });
});
