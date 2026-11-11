/**
 * Property tests of the prefs form's filter, on schemas keyed by `Object.prototype`'s names among others: the root
 * keeps each child its subtree filter keeps, as its own key.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { filterPrefSubtree } from '@weasel-js/prefs';
import { prefGroup, runs, tally, timeoutFor } from '../../pbt.fixture';
import { filterPrefRoot } from './schema';

const RUNS = 300;

describe('filterPrefRoot', () => {
  it('keeps exactly the children whose subtree the query leaves, as own keys, and the root itself for no query', () => {
    const t = tally();
    fc.assert(fc.property(prefGroup(), fc.constantFrom('', ' ', 'grid', 'SNAP', 'si', 'zz'), (root, q) => {
      const out = filterPrefRoot(root, q, root);
      if (q.trim() === '') { expect(out).toBe(root); return; }
      const want = Object.keys(root.children).filter((k) => filterPrefSubtree(root.children[k]!, q, k, root) !== null);
      if (want.length === 0) { expect(out).toBeNull(); t.count('none'); return; }
      expect(Object.keys(out!.children)).toEqual(want);
      expect(Object.getPrototypeOf(out!.children)).toBe(Object.prototype);
      for (const k of want) expect(out!.children[k]).toEqual(filterPrefSubtree(root.children[k]!, q, k, root));
      t.count('kept');
      if (want.includes('__proto__')) t.count('proto');
    }), runs(RUNS));
    t.atLeast('none', 20);
    t.atLeast('kept', 50);
    t.atLeast('proto', 2);
  }, timeoutFor(RUNS, 2));
});

describe('filterPrefRoot, shrunk', () => {
  it('keeps a matching child keyed `__proto__` as its own key', () => {
    const children = {};
    Object.defineProperty(children, '__proto__', { value: { kind: 'boolean', name: 'Snap', default: false }, enumerable: true, writable: true, configurable: true });
    const root = { name: 'Grid', children } as Parameters<typeof filterPrefRoot>[0];
    expect(Object.keys(filterPrefRoot(root, 'SNAP', root)!.children)).toEqual(['__proto__']);
  });
});
