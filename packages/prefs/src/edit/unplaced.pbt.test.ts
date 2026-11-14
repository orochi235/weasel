/**
 * Property tests of what the schema editor still has to place: `stillUnplaced` keeps each leaf whose key the schema
 * holds nowhere and each group left holding one, and `unplacedAt` finds a node by own keys alone.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { prefGroup, runs, segment, tally, timeoutFor } from '../pbt.fixture';
import { stillUnplaced, unplacedAt } from './unplaced';

const RUNS = 300;

function leafKeys(g: PrefGroup): string[] {
  return Object.keys(g.children).flatMap((k) => {
    const c = g.children[k]!;
    return isPrefLeaf(c) ? [k] : leafKeys(c as PrefGroup);
  });
}

/** `g` with only the leaves `keep` passes, and only the groups still holding one. */
function cut(g: PrefGroup, keep: (k: string) => boolean): PrefGroup | null {
  const entries = Object.keys(g.children).flatMap((k): [string, PrefGroup | PrefLeaf][] => {
    const c = g.children[k]!;
    if (isPrefLeaf(c)) return keep(k) ? [[k, c]] : [];
    const left = cut(c as PrefGroup, keep);
    return left ? [[k, left]] : [];
  });
  return entries.length === 0 ? null : { ...g, children: Object.fromEntries(entries) };
}

describe('stillUnplaced', () => {
  it('keeps the leaves the schema holds no leaf of, under the groups that hold them', () => {
    const t = tally();
    fc.assert(fc.property(prefGroup(), prefGroup(), (unplaced, schema) => {
      const held = new Set(leafKeys(schema));
      const out = stillUnplaced(unplaced, schema);
      const want = cut(unplaced, (k) => !held.has(k));
      expect(out).toEqual(want);
      if (out) {
        const walk = (g: PrefGroup): void => {
          expect(Object.getPrototypeOf(g.children)).toBe(Object.prototype);
          for (const c of Object.values(g.children)) if (!isPrefLeaf(c)) walk(c as PrefGroup);
        };
        walk(out);
        t.count(leafKeys(out).length < leafKeys(unplaced).length ? 'cut' : 'whole');
        if (leafKeys(out).includes('__proto__') || Object.keys(out.children).includes('__proto__')) t.count('proto');
      } else t.count('none');
    }), runs(RUNS));
    for (const k of ['cut', 'whole', 'none', 'proto']) t.atLeast(k, 10);
  }, timeoutFor(RUNS, 2));
});

describe('unplacedAt', () => {
  it('walks own keys only', () => {
    const t = tally();
    fc.assert(fc.property(prefGroup(), fc.array(segment, { maxLength: 3 }), (root, keys) => {
      let at: PrefGroup | PrefLeaf | undefined = root;
      for (const k of keys) at = at === undefined || isPrefLeaf(at) || !Object.hasOwn(at.children, k) ? undefined : at.children[k];
      expect(unplacedAt(root, keys)).toBe(at);
      t.count(at === undefined ? 'missing' : 'found');
    }), runs(RUNS));
    t.atLeast('missing', 30);
    t.atLeast('found', 30);
  }, timeoutFor(RUNS, 1));
});

describe('stillUnplaced, shrunk', () => {
  it('keeps an unplaced leaf keyed `__proto__`', () => {
    const children = {};
    Object.defineProperty(children, '__proto__', { value: { kind: 'boolean', name: 'Grid', default: false }, enumerable: true, writable: true, configurable: true });
    const out = stillUnplaced({ name: 'Grid', children: { a: { name: 'Grid', children } } } as unknown as PrefGroup, { name: 'Grid', children: {} } as PrefGroup);
    expect(leafKeys(out!)).toEqual(['__proto__']);
  });
});
