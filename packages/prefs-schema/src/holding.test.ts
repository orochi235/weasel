import { describe, expect, it } from 'vitest';
import type { PrefGroup } from './groups';
import { prefLeavesHolding, UNSEEN, UNSEEN_LEAF } from './holding';
import type { PrefLeaf, PrefObject } from './schema';
import { prefShownReader } from './shown';
import { prefValueAt } from './helpers';
import type { PrefUnion } from './union';

const object = (children: PrefObject['children']): PrefObject =>
  ({ kind: 'object', name: 'V', description: '', default: {}, children });
const toggle = { kind: 'boolean', name: 'Y', description: '', default: false } as PrefLeaf;
const list = { kind: 'list', name: 'L', description: '', default: [], item: toggle } as unknown as PrefLeaf;

describe('prefLeavesHolding', () => {
  it('keeps the variant describing a field when another variant holds a list at the same key', () => {
    for (const order of [['p', 'q'], ['q', 'p']]) {
      const variants: Record<string, PrefObject> = {
        p: object({ x: object({ y: toggle }) }),
        q: object({ x: list }),
      };
      const u: PrefUnion = {
        kind: 'union', name: 'U', description: '', default: undefined, tag: 'type',
        variants: Object.fromEntries(order.map((k) => [k, variants[k]!])),
      };
      const schema: PrefGroup = { name: '', children: { u } };
      const found = prefLeavesHolding(schema, 'u.x.y');
      expect(found).not.toBe(UNSEEN);
      expect(found).toEqual(expect.arrayContaining([
        { leaf: toggle, within: 'u.x', variants: [{ at: 'u', tag: 'type', key: 'p' }] },
        { leaf: UNSEEN_LEAF, variants: [{ at: 'u', tag: 'type', key: 'q' }] },
      ]));
    }
  });

  it('reads a field every variant reaches only through a list as unseen', () => {
    const u: PrefUnion = {
      kind: 'union', name: 'U', description: '', default: undefined, tag: 'type',
      variants: { q: object({ x: list }) },
    };
    expect(prefLeavesHolding({ name: '', children: { u } }, 'u.x.y')).toBe(UNSEEN);
  });

  it('lets a condition read a union field through the encoding of the variant held', () => {
    const encoded = { ...toggle, encoding: { read: (v: unknown) => v === 'on', write: (on: boolean) => (on ? 'on' : 'off') } } as PrefLeaf;
    const u: PrefUnion = {
      kind: 'union', name: 'U', description: '', default: undefined, tag: 'type',
      variants: { q: object({ x: list }), p: object({ x: object({ y: encoded }) }) },
    };
    const values = { u: { type: 'p', x: { y: 'on' } } };
    const read = prefShownReader({ name: '', children: { u } }, (path) => prefValueAt(values, path));
    expect(read('u.x.y')).toBe(true);
  });
});
