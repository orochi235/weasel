import fc from 'fast-check';
import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from './groups';
import { admits, leaf, runs, sameValue, stored, tally, timeoutFor, valueOf } from './pbt.fixture';
import type { PrefLeaf } from './schema';
import { isStampedRecord } from './stamp';
import { createPrefsStore } from './store';

const schemaOf = (l: PrefLeaf, m: PrefLeaf): PrefGroup => ({ name: 'S', children: { g: { name: 'G', children: { l } }, m } });

const open = (schema: PrefGroup, initial: [string, unknown][] = []) => {
  const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial });
  return { cache, store: createPrefsStore(schema, cache, undefined, undefined, 2) };
};

/** The cache's records as JSON storage would hand them back. */
const throughJson = (cache: ReturnType<typeof open>['cache']): [string, unknown][] =>
  cache.entries().flatMap(([name, record]) => {
    const text = JSON.stringify(record);
    return text === undefined ? [] : [[name, JSON.parse(text) as unknown] as [string, unknown]];
  });

const leafAndValue = leaf().chain((l) => fc.tuple(fc.constant(l), valueOf(l)));

describe('a store, properties', () => {
  it('reads a value set as itself, and again after storage keeps it as JSON', () => {
    const t = tally();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fc.assert(
      fc.property(leafAndValue, leafAndValue, ([l, v], [m, w]) => {
        const schema = schemaOf(l, m);
        const { cache, store } = open(schema);
        store.set('g.l' as never, v as never);
        store.set('m' as never, w as never);
        t.count(l.kind);
        if (v === Infinity || v === -Infinity) t.count('infinity');
        expect(sameValue(store.get('g.l' as never), v)).toBe(true);
        expect(sameValue(store.get('m' as never), w)).toBe(true);
        expect(sameValue((store.values().g as Record<string, unknown>).l, v)).toBe(true);
        expect(store.isSet('g.l' as never)).toBe(true);

        const again = open(schema, throughJson(cache)).store;
        expect(sameValue(again.get('g.l' as never), v)).toBe(true);
        expect(sameValue(again.get('m' as never), w)).toBe(true);
      }),
      runs(300),
    );
    warn.mockRestore();
    for (const kind of ['number', 'boolean', 'string', 'enum', 'object', 'list', 'map', 'union']) t.atLeast(kind, 3);
    t.atLeast('infinity', 3);
  }, timeoutFor(300, 10));

  it('reads any stored record as a value the leaf admits, the same through JSON, and its default once reset', () => {
    const t = tally();
    fc.assert(
      fc.property(leaf(), stored, (l, s) => {
        // A bare record shaped like a stamp is read as one: a build from before stamps wrote no such value.
        if (isStampedRecord(s)) return;
        const schema = schemaOf(l, l);
        const { cache, store } = open(schema, [['g.l', s], ['m', { $at: 1, value: s }]]);
        const read = store.get('g.l' as never);
        t.count(sameValue(read, l.default) ? 'default' : 'kept');
        expect(admits(l, read)).toBe(true);
        expect(sameValue(store.get('m' as never), read)).toBe(true);
        expect(admits(l, open(schema, throughJson(cache)).store.get('g.l' as never))).toBe(true);
        store.reset('g');
        expect(store.isSet('g.l' as never)).toBe(false);
        expect(sameValue(store.get('g.l' as never), l.default)).toBe(true);
        expect(store.isSet('m' as never)).toBe(true);
      }),
      runs(300),
    );
    t.atLeast('default', 20);
    t.atLeast('kept', 20);
  }, timeoutFor(300, 10));
});
