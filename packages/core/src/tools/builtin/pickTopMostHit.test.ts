import { describe, it, expect } from 'vitest';
import { pickTopMostHit } from './pickTopMostHit';

describe('pickTopMostHit', () => {
  it('returns null for empty hit list', () => {
    expect(pickTopMostHit([], { getParent: () => null })).toBeNull();
  });

  it('returns the single id when only one hit, regardless of adapter', () => {
    expect(pickTopMostHit(['a'], undefined)).toBe('a');
    expect(pickTopMostHit(['a'], { getParent: () => null })).toBe('a');
  });

  it('drops the parent when its child is also in the hit set', () => {
    // F (container) listed before f1 (child) — common parent/child
    // container-eats-child case. Without `getParent`, the result would
    // be `F` (or `f1` depending on which "tiebreaker" we picked).
    const parents: Record<string, string | null> = { F: null, f1: 'F' };
    const got = pickTopMostHit(['F', 'f1'], { getParent: (id) => parents[id] ?? null });
    expect(got).toBe('f1');
  });

  it('drops the parent regardless of order in the hit list', () => {
    const parents: Record<string, string | null> = { F: null, f1: 'F' };
    const got = pickTopMostHit(['f1', 'F'], { getParent: (id) => parents[id] ?? null });
    expect(got).toBe('f1');
  });

  it('drops grandparents and parents when a deep descendant is in the hit set', () => {
    // root > group > leaf. All three cover the click.
    const parents: Record<string, string | null> = { root: null, group: 'root', leaf: 'group' };
    const got = pickTopMostHit(['root', 'group', 'leaf'], { getParent: (id) => parents[id] ?? null });
    expect(got).toBe('leaf');
  });

  it('returns the last id when no parent/child relation exists (sibling fallback)', () => {
    // Two siblings overlap; no getParent or all-null parents — fall back to
    // "last", matching the common forward-iteration "bottom-first" convention.
    const got = pickTopMostHit(['a', 'b'], { getParent: () => null });
    expect(got).toBe('b');
  });

  it('falls back to last id when no adapter at all', () => {
    expect(pickTopMostHit(['a', 'b', 'c'], undefined)).toBe('c');
    expect(pickTopMostHit(['a', 'b', 'c'], null)).toBe('c');
  });

  it('with mixed: keeps deepest among children-set, ignores unrelated siblings', () => {
    // Hit set: [parent, child, sibling]. Parent contains child; sibling is
    // unrelated. After parent drop -> ['child', 'sibling']. Tiebreaker picks
    // last: 'sibling'. (We don't know z-order between child and sibling.)
    const parents: Record<string, string | null> = { P: null, c: 'P', s: null };
    const got = pickTopMostHit(['P', 'c', 's'], { getParent: (id) => parents[id] ?? null });
    expect(got).toBe('s');
  });

  it('survives a malformed adapter with cyclic getParent without infinite-looping', () => {
    // Should not throw or hang.
    const got = pickTopMostHit(['a', 'b'], { getParent: (id) => (id === 'a' ? 'b' : 'a') });
    // Both are "ancestors" of each other under the cycle — both get dropped,
    // leaving []. Filtered length 0 — fall through to the fallback.
    // Both are "ancestors" under the cycle and both get dropped; helper
    // falls back to the original ids' last entry.
    expect(got).toBe('b');
  });
});
