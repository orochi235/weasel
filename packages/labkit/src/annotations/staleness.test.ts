import { describe, expect, it } from 'vitest';
import { isStale, seenFrom } from './staleness';

const KEYS = ['angle', 'shading', 'shade_style'] as const;
const CONFIG = { angle: 'iso', shading: 'outline', shade_style: 'flat3', render_px: 512 };

describe('seenFrom', () => {
  it('snapshots only the declared keys', () => {
    // render_px is deliberately not declared: the mark is fractional, so
    // resolution does not move it.
    expect(seenFrom(CONFIG, KEYS)).toEqual({
      angle: 'iso',
      shading: 'outline',
      shade_style: 'flat3',
    });
  });

  it('omits a declared key the config does not carry', () => {
    expect(seenFrom({ angle: 'top' }, KEYS)).toEqual({ angle: 'top' });
  });

  it('is empty when nothing is declared', () => {
    expect(seenFrom(CONFIG, [])).toEqual({});
  });
});

describe('isStale', () => {
  it('is not stale against the config it was taken from', () => {
    expect(isStale(seenFrom(CONFIG, KEYS), CONFIG, KEYS)).toBe(false);
  });

  it('is stale when a declared key changed', () => {
    const seen = seenFrom(CONFIG, KEYS);
    expect(isStale(seen, { ...CONFIG, angle: 'top' }, KEYS)).toBe(true);
  });

  it('ignores an undeclared key changing', () => {
    const seen = seenFrom(CONFIG, KEYS);
    expect(isStale(seen, { ...CONFIG, render_px: 1024 }, KEYS)).toBe(false);
  });

  it('ignores a key the stored snapshot never had', () => {
    // A mark filed before the target declared a new dependency must not go
    // stale retroactively — nothing can know what that key was at the time.
    const old = { angle: 'iso' };
    expect(isStale(old, CONFIG, KEYS)).toBe(false);
  });

  it('is not stale with no snapshot at all', () => {
    expect(isStale(undefined, CONFIG, KEYS)).toBe(false);
  });

  it('is never stale when the target declares no dependencies', () => {
    expect(isStale(seenFrom(CONFIG, KEYS), { angle: 'top' }, [])).toBe(false);
  });
});
