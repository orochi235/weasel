/**
 * Property tests of `byRank` and the palette's `groupTools` built on it: a stable permutation that puts named keys in
 * the order named and keeps everything else where it was, after them.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Tool } from '@weasel-js/core';
import { byRank } from './byRank';
import { groupTools } from './components/ToolPalette/order';
import { key, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

describe('byRank', () => {
  it('is a stable permutation ranked by the first place `order` names each key', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(key, { maxLength: 12 }), fc.array(key, { maxLength: 8 }), (keys, order) => {
      const items = keys.map((k, i) => ({ k, i }));
      const out = byRank(items, (x) => x.k, order);
      expect([...out].sort((a, b) => a.i - b.i)).toEqual(items);
      const rank = (k: string) => { const r = order.indexOf(k); return r < 0 ? order.length : r; };
      for (let j = 1; j < out.length; j++) {
        const a = out[j - 1]!; const b = out[j]!;
        expect(rank(a.k) < rank(b.k) || (rank(a.k) === rank(b.k) && a.i < b.i)).toBe(true);
        if (rank(a.k) === rank(b.k) && rank(a.k) < order.length) t.count('tie');
      }
      if (out.some((x) => order.includes(x.k)) && out.some((x) => !order.includes(x.k))) t.count('mixed');
    }), runs(RUNS));
    t.atLeast('mixed', 20);
    t.atLeast('tie', 5);
  }, timeoutFor(RUNS, 2));

  it('is idempotent', () => {
    fc.assert(fc.property(fc.array(key, { maxLength: 12 }), fc.array(key, { maxLength: 8 }), (keys, order) => {
      const once = byRank(keys, (k) => k, order);
      expect(byRank(once, (k) => k, order)).toEqual(once);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('groupTools', () => {
  const tool = (id: string, group: string | undefined): Tool =>
    ({ id, ...(group === undefined ? {} : { presentation: { group } }) }) as unknown as Tool;

  it('holds every tool once, grouped by key, misc last, named groups and tools in their order', () => {
    const t = tally();
    const arb = fc.array(fc.tuple(key, fc.option(fc.constantFrom('draw', 'edit', 'misc', 'view', '__proto__', 'toString'), { nil: undefined })), { maxLength: 12 });
    fc.assert(fc.property(arb, fc.array(fc.constantFrom('draw', 'edit', 'view', 'misc', 'toString'), { maxLength: 4 }), fc.array(key, { maxLength: 6 }), (spec, groupOrder, toolOrder) => {
      const list = spec.map(([id, g]) => tool(id, g));
      const out = groupTools(list, groupOrder, toolOrder);
      expect(out.flatMap((g) => g.tools).length).toBe(list.length);
      expect(new Set(out.flatMap((g) => g.tools)).size).toBe(new Set(list).size);
      const keys = out.map((g) => g.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const g of out) {
        expect(g.tools.length).toBeGreaterThan(0);
        for (const x of g.tools) expect(x.presentation?.group ?? 'misc').toBe(g.key);
        expect(g.tools).toEqual(byRank(list.filter((x) => (x.presentation?.group ?? 'misc') === g.key), (x) => x.id, toolOrder));
      }
      if (keys.includes('misc')) { expect(keys.at(-1)).toBe('misc'); t.count('misc'); }
      const named = keys.filter((k) => k !== 'misc');
      expect(named).toEqual(byRank(named, (k) => k, groupOrder));
      if (named.length > 1) t.count('several');
    }), runs(RUNS));
    t.atLeast('misc', 20);
    t.atLeast('several', 20);
  }, timeoutFor(RUNS, 2));
});

describe('byRank, shrunk', () => {
  it('ranks a key named twice by its first place', () => {
    expect(byRank(['a', 'd'], (k) => k, ['d', 'a', 'd'])).toEqual(['d', 'a']);
  });
});
