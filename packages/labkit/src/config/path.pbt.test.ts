/**
 * Property tests of the dotted-path walks a config is read and written by: a write reads back and touches nothing
 * beside its path, the input is never changed, a copy is equal and shares no branch, and a fill keeps what was
 * stored and is idempotent. Keys every object inherits are drawn as often as ordinary ones.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { configTree, key, leafValue, path, runs, tally, timeoutFor } from '../pbt.fixture';
import { copyTree, fillConfigDefaults, hasConfigPath, valueAtPath, withValueAtPath } from './path';

const RUNS = 300;

/** Whether one path is the other or lies under it. */
const nested = (p: string, q: string): boolean =>
  p === q || p.startsWith(`${q}.`) || q.startsWith(`${p}.`);

/** Every record and array under `value`. */
function branches(value: unknown, out = new Set<object>()): Set<object> {
  if (value !== null && typeof value === 'object') {
    out.add(value);
    for (const v of Object.values(value)) branches(v, out);
  }
  return out;
}

/** Every dotted path to a leaf of `tree`, a record's own keys only. */
function leafPaths(tree: unknown, at = ''): string[] {
  if (tree === null || typeof tree !== 'object' || Array.isArray(tree))
    return at === '' ? [] : [at];
  const entries = Object.entries(tree);
  if (entries.length === 0) return at === '' ? [] : [at];
  return entries.flatMap(([k, v]) => leafPaths(v, at === '' ? k : `${at}.${k}`));
}

const isPlain = (v: unknown): boolean => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The proper prefixes of a dotted path, shortest first. */
const prefixes = (p: string): string[] =>
  p
    .split('.')
    .slice(0, -1)
    .map((_, i, s) => s.slice(0, i + 1).join('.'));

describe('withValueAtPath', () => {
  it(
    'reads back at its path, changes no path beside it, and leaves its input alone',
    () => {
      const t = tally();
      fc.assert(
        fc.property(configTree, path, leafValue, path, (tree, p, v, q) => {
          const before = structuredClone(tree);
          const out = withValueAtPath(tree, p, v);
          expect(tree).toEqual(before);
          expect(valueAtPath(out, p)).toBe(v);
          expect(hasConfigPath(out, p)).toBe(true);
          if (!nested(p, q)) {
            t.count(valueAtPath(tree, q) === undefined ? 'beside, absent' : 'beside, held');
            expect(valueAtPath(out, q)).toEqual(valueAtPath(tree, q));
            expect(hasConfigPath(out, q)).toBe(hasConfigPath(tree, q));
          }
          if (p.split('.').includes('__proto__')) t.count('through __proto__');
        }),
        runs(RUNS),
      );
      t.atLeast('beside, held', 10);
      t.atLeast('beside, absent', 30);
      t.atLeast('through __proto__', 30);
    },
    timeoutFor(RUNS, 2),
  );

  it(
    'writing a path again replaces the first write, and writing what it reads changes nothing',
    () => {
      fc.assert(
        fc.property(configTree, path, leafValue, leafValue, (tree, p, v, w) => {
          const twice = withValueAtPath(withValueAtPath(tree, p, v), p, w);
          expect(twice).toEqual(withValueAtPath(tree, p, w));
          if (hasConfigPath(tree, p))
            expect(withValueAtPath(tree, p, valueAtPath(tree, p))).toEqual(tree);
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 2),
  );
});

describe('valueAtPath and hasConfigPath', () => {
  it(
    'reach every leaf of a tree at its path, and nothing an object inherits',
    () => {
      const t = tally();
      fc.assert(
        fc.property(configTree, key, (tree, k) => {
          for (const p of leafPaths(tree)) {
            expect(hasConfigPath(tree, p)).toBe(true);
            t.count('leaf');
          }
          const isRecord = tree !== null && typeof tree === 'object' && !Array.isArray(tree);
          if (isRecord && !Object.hasOwn(tree, k)) {
            t.count('inherited');
            expect(valueAtPath(tree, k)).toBeUndefined();
            expect(hasConfigPath(tree, k)).toBe(false);
          }
        }),
        runs(RUNS),
      );
      t.atLeast('leaf', 100);
      t.atLeast('inherited', 50);
    },
    timeoutFor(RUNS, 2),
  );
});

describe('copyTree', () => {
  it(
    'is equal to its input, own keys and all, and shares none of its branches',
    () => {
      fc.assert(
        fc.property(configTree, (tree) => {
          const copy = copyTree(tree);
          expect(copy).toEqual(tree);
          expect(leafPaths(copy)).toEqual(leafPaths(tree));
          const mine = branches(tree);
          for (const b of branches(copy)) expect(mine.has(b)).toBe(false);
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 2),
  );
});

describe('fillConfigDefaults', () => {
  it(
    'keeps every value stored, fills every gap from the defaults, and is idempotent',
    () => {
      const t = tally();
      fc.assert(
        fc.property(configTree, configTree, (stored, defaults) => {
          const out = fillConfigDefaults(stored, defaults);
          expect(fillConfigDefaults(out, defaults)).toEqual(out);
          for (const p of leafPaths(stored)) {
            // A branch the defaults hold where the stored leaf stands is filled in its place.
            if (isPlain(valueAtPath(defaults, p)) || valueAtPath(stored, p) === undefined) continue;
            t.count('kept');
            expect(valueAtPath(out, p)).toEqual(valueAtPath(stored, p));
          }
          for (const p of leafPaths(defaults)) {
            if (valueAtPath(stored, p) !== undefined) continue;
            const over = prefixes(p).some((q) => {
              const v = valueAtPath(stored, q);
              return v !== undefined && !isPlain(v);
            });
            t.count(over ? 'filled over a stored leaf' : 'filled');
            expect(valueAtPath(out, p)).toEqual(valueAtPath(defaults, p));
          }
        }),
        runs(RUNS),
      );
      t.atLeast('kept', 30);
      t.atLeast('filled', 100);
      t.atLeast('filled over a stored leaf', 10);
    },
    timeoutFor(RUNS, 2),
  );
});
