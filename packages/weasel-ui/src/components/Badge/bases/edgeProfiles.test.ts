import { describe, it, expect } from 'vitest';
import { EDGE_PROFILES, resolveEdge, type EdgeProfile } from './edgeProfiles';

describe('EDGE_PROFILES', () => {
  it('flat returns 0 for all t', () => {
    expect(EDGE_PROFILES.flat(0, 6)).toBe(0);
    expect(EDGE_PROFILES.flat(0.5, 6)).toBe(0);
    expect(EDGE_PROFILES.flat(1, 6)).toBe(0);
  });

  it('chevron peaks at t=0.5 and is zero at endpoints', () => {
    expect(EDGE_PROFILES.chevron(0, 10)).toBeCloseTo(0);
    expect(EDGE_PROFILES.chevron(0.5, 10)).toBeCloseTo(10);
    expect(EDGE_PROFILES.chevron(1, 10)).toBeCloseTo(0);
  });

  it('slant rises linearly from 0 at t=0 to depth at t=1', () => {
    expect(EDGE_PROFILES.slant(0, 8)).toBeCloseTo(0);
    expect(EDGE_PROFILES.slant(0.5, 8)).toBeCloseTo(4);
    expect(EDGE_PROFILES.slant(1, 8)).toBeCloseTo(8);
  });

  it('slant-up is the mirror of slant', () => {
    expect(EDGE_PROFILES['slant-up'](0, 8)).toBeCloseTo(8);
    expect(EDGE_PROFILES['slant-up'](1, 8)).toBeCloseTo(0);
  });

  it('round is zero at endpoints and depth at midpoint', () => {
    expect(EDGE_PROFILES.round(0, 6)).toBeCloseTo(0);
    expect(EDGE_PROFILES.round(0.5, 6)).toBeCloseTo(6);
    expect(EDGE_PROFILES.round(1, 6)).toBeCloseTo(0);
  });

  it('concave-chevron is the negation of chevron', () => {
    expect(EDGE_PROFILES['concave-chevron'](0.5, 10)).toBeCloseTo(-10);
  });

  it('scallop oscillates and is bounded by 0.4 * depth', () => {
    for (let i = 0; i <= 10; i++) {
      const v = EDGE_PROFILES.scallop(i / 10, 10);
      expect(Math.abs(v)).toBeLessThanOrEqual(10 * 0.4 + 1e-9);
    }
  });
});

describe('resolveEdge', () => {
  it('returns the registered profile for a known name', () => {
    expect(resolveEdge('chevron')).toBe(EDGE_PROFILES.chevron);
  });

  it('returns a custom function unchanged', () => {
    const custom: EdgeProfile = (t, d) => t * d * 2;
    expect(resolveEdge(custom)).toBe(custom);
  });

  it('falls back to flat for an unknown name', () => {
    // @ts-expect-error intentional bad name
    expect(resolveEdge('bogus')).toBe(EDGE_PROFILES.flat);
  });
});
