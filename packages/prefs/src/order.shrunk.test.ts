import { describe, expect, it } from 'vitest';
import type { PrefGroup } from './groups';
import { filterPrefSubtree, visiblePrefSubtree } from './helpers';
import { orderPrefGroup } from './order';

const leaf = (name: string) => ({ kind: 'string', name, description: '', default: '' }) as const;
const SCHEMA: PrefGroup = {
  name: 'G',
  children: { sub: { name: 'S', children: Object.fromEntries([['__proto__', leaf('Proto')], ['e', leaf('E')]]) } },
};
const sub = (g: PrefGroup | null) => (g!.children.sub as PrefGroup).children;

describe('a child keyed `__proto__` (shrunk)', () => {
  it('is kept when its group is reordered', () => {
    expect(Object.keys(sub(orderPrefGroup(SCHEMA, { sub: ['e', '__proto__'] })))).toEqual(['e', '__proto__']);
  });

  it('is kept by the visible and the filtered subtree', () => {
    expect(Object.keys(sub(visiblePrefSubtree({ ...SCHEMA, children: { ...SCHEMA.children, gone: { ...leaf('Gone'), hidden: true } } }, false)))).toEqual(['__proto__', 'e']);
    expect(Object.keys(sub(filterPrefSubtree(SCHEMA, 'proto')))).toEqual(['__proto__']);
  });
});
