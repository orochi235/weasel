/**
 * Property tests of `bake` and `bakeChain` over random definitions, alone and extending another: a baked chain read
 * at any selection, as the runtime reads it, holds what `derive` produces there and otherwise only what falls through
 * from above; and a baked theme survives JSON.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { enumerateSelections } from '../axes';
import { tokensAt } from '../chainTokens';
import type { ThemeDefinition } from '../definition';
import type { RawToken } from '../dtcg/types';
import { outcome, runs, tally, timeoutFor } from '../pbt.fixture';
import { bake, bakeChain } from './bake';
import { AXES, definition } from './definition.fixture';
import { derive } from './derive';
import type { Lookup } from './merge';

const RUNS = 150;
const SELECTIONS = enumerateSelections(AXES);

const plain = (t: RawToken) => JSON.parse(JSON.stringify(t)) as RawToken;
const plainAll = (tokens: Readonly<Record<string, RawToken>>) => Object.fromEntries(Object.entries(tokens).map(([n, t]) => [n, plain(t)]));

/** A root alone, or a root and a child extending it. */
const chain = fc.tuple(definition('root'), definition('kid'), fc.boolean()).map(([root, kid, two]) => {
  const defs = two ? [root, { ...kid, extends: 'root' }] : [root];
  const lookup: Lookup = (n) => defs.find((d) => d.name === n);
  return { top: defs.at(-1)! as ThemeDefinition, lookup };
});

describe('bake', () => {
  it('a baked chain read at any selection holds what derive produces there', () => {
    const t = tally();
    fc.assert(fc.property(chain, ({ top, lookup }) => {
      const baked = outcome(() => bakeChain(top, lookup));
      if (typeof baked === 'string') return;
      for (const sel of SELECTIONS) {
        const derived = outcome(() => derive(top, sel, lookup).tokens);
        if (typeof derived === 'string') continue;
        t.count(top.extends ? 'child' : 'root');
        const read = tokensAt(baked, sel);
        const own = tokensAt(baked.slice(-1), sel);
        // A token the top theme produces nowhere falls through to the one it extends, which the runtime cannot unset.
        for (const n of Object.keys(read)) {
          if (Object.hasOwn(derived, n)) continue;
          t.count('falls through');
          expect(Object.hasOwn(own, n)).toBe(false);
        }
        const shown = Object.fromEntries(Object.keys(derived).map((n) => [n, read[n]]));
        expect(plainAll(shown)).toEqual(plainAll(derived));
      }
    }), runs(RUNS));
    t.atLeast('root', 100);
    t.atLeast('child', 100);
  }, timeoutFor(RUNS, 80));

  it('a baked theme is plain data: JSON reads it back unchanged', () => {
    fc.assert(fc.property(definition(), (def) => {
      const baked = outcome(() => bake(def));
      if (typeof baked === 'string') return;
      expect(JSON.parse(JSON.stringify(baked))).toEqual(baked);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 40));
});
