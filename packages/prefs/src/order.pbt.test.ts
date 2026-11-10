import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { PrefGroup } from './groups';
import { orderPrefGroup, resolveOrder } from './order';
import { runs, tally, timeoutFor } from './pbt.fixture';

const name: fc.Arbitrary<string> = fc.constantFrom('a', 'b', 'c', 'd', 'e', '__proto__', 'constructor');

describe('prefs order, properties', () => {
  it('resolves to every key once, the stored ones in their stored order', () => {
    const t = tally();
    fc.assert(
      fc.property(fc.uniqueArray(name, { maxLength: 6 }), fc.option(fc.array(name, { maxLength: 8 }), { nil: undefined }), fc.constantFrom<'schema' | 'end'>('schema', 'end'), (keys, stored, missing) => {
        const out = resolveOrder(keys, stored, missing);
        t.count(stored?.some((k) => keys.includes(k)) ? 'stored' : 'none');
        expect([...out].sort()).toEqual([...keys].sort());
        const kept = [...new Set(stored?.filter((k) => keys.includes(k)))];
        expect(out.filter((k) => kept.includes(k))).toEqual(kept);
        if (missing === 'end') expect(out.slice(0, kept.length)).toEqual(kept);
        if (!stored?.length) expect(out).toEqual(keys);
      }),
      runs(500),
    );
    t.atLeast('stored', 50);
  }, timeoutFor(500, 1));

  it('reorders a group without adding, dropping, or changing a child', () => {
    const t = tally();
    const leaf = (key: string) => ({ kind: 'string', name: key, description: '', default: '' }) as const;
    const groupOf = (keys: readonly string[], inner: readonly string[]): PrefGroup => ({
      name: 'G',
      children: Object.fromEntries([...keys.map((k) => [k, leaf(k)] as const), ['sub', { name: 'S', children: Object.fromEntries(inner.map((k) => [k, leaf(k)])) }] as const]),
    });
    fc.assert(
      fc.property(fc.uniqueArray(name, { maxLength: 5 }), fc.uniqueArray(name, { maxLength: 4 }), fc.array(name, { maxLength: 6 }), fc.array(name, { maxLength: 4 }), (keys, inner, top, sub) => {
        const group = groupOf(keys, inner);
        const out = orderPrefGroup(group, { '': [...top, 'sub'], sub });
        t.count(keys.includes('__proto__') || inner.includes('__proto__') ? '__proto__' : 'plain');
        expect(Object.keys(out.children).sort()).toEqual(Object.keys(group.children).sort());
        for (const k of Object.keys(group.children)) {
          if (k !== 'sub') expect(Object.hasOwn(out.children, k) && out.children[k]).toBe(group.children[k]);
        }
        const subOut = out.children.sub as PrefGroup;
        expect(Object.keys(subOut.children).sort()).toEqual([...inner].sort());
        expect(Object.keys(subOut.children)).toEqual(resolveOrder(inner, sub, 'schema'));
      }),
      runs(400),
    );
    t.atLeast('__proto__', 30);
  }, timeoutFor(400, 1));
});
