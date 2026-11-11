/**
 * Property tests of a bar's reorder helpers: `movedOrder` writes one container's list as a move of one key, and
 * `childKeysAt` finds the group at a path and nothing else, its keys including `Object.prototype`'s names.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { PrefGroup } from '@weasel-js/prefs';
import { moveItems } from '@weasel-js/ui-logic';
import { key, prefGroup, runs, segment as seg, tally, timeoutFor } from '../../pbt.fixture';
import { childKeysAt, movedOrder } from './barOrder';

const RUNS = 300;

const group = prefGroup();

/** Every path to a group in `g`, `''` for `g` itself. */
function groupPaths(g: PrefGroup, at = ''): string[] {
  return [at, ...Object.keys(g.children).flatMap((k) => {
    const c = g.children[k]!;
    return 'kind' in c ? [] : groupPaths(c as PrefGroup, at === '' ? k : `${at}.${k}`);
  })];
}

describe('childKeysAt', () => {
  it('answers a group’s own keys at its path, and undefined at any other', () => {
    const t = tally();
    fc.assert(fc.property(group, fc.array(seg, { maxLength: 3 }), (g, segs) => {
      const real = groupPaths(g);
      for (const p of real) {
        let at: PrefGroup = g;
        for (const s of p === '' ? [] : p.split('.')) at = at.children[s] as PrefGroup;
        expect(childKeysAt(g, p)).toEqual(Object.keys(at.children));
        if (p !== '') t.count('nested');
      }
      const path = segs.join('.');
      if (!real.includes(path)) {
        expect(childKeysAt(g, path)).toBeUndefined();
        if (segs.some((s) => s in Object.prototype)) t.count('inherited name');
      }
    }), runs(RUNS));
    t.atLeast('nested', 30);
    t.atLeast('inherited name', 20);
  }, timeoutFor(RUNS, 2));
});

describe('movedOrder', () => {
  it('sets the container’s list to the move, or hands back the order for an index out of range', () => {
    const t = tally();
    fc.assert(fc.property(fc.uniqueArray(key, { maxLength: 6 }), key, fc.oneof({ arbitrary: fc.nat(5), weight: 4 }, fc.integer({ min: -2, max: 8 })), fc.oneof({ arbitrary: fc.nat(6), weight: 4 }, fc.integer({ min: -2, max: 8 })), fc.oneof({ arbitrary: fc.constant(0), weight: 5 }, fc.constant(0.5)), (keys, container, from, to, frac) => {
      const order = { other: ['x'] };
      const f = from + (frac === 0.5 ? 0.5 : 0);
      const out = movedOrder(order, container, keys, f, to);
      const ok = Number.isInteger(f) && f >= 0 && f < keys.length && to >= 0 && to <= keys.length;
      if (!ok) { expect(out).toBe(order); t.count('refused'); return; }
      t.count('moved');
      expect(Object.hasOwn(out, container)).toBe(true);
      expect(out[container]).toEqual(moveItems(keys, [f], to));
      if (container !== 'other') expect(out.other).toEqual(['x']);
      expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    }), runs(RUNS));
    t.atLeast('refused', 30);
    t.atLeast('moved', 30);
  }, timeoutFor(RUNS, 1));
});

describe('childKeysAt, shrunk', () => {
  it('finds no group under a name every object inherits', () => {
    expect(childKeysAt({ children: {} } as PrefGroup, 'constructor')).toBeUndefined();
  });
});
