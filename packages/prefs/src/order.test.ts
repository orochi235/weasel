import { describe, expect, it } from 'vitest';
import type { PrefActions } from './action';
import { pref } from './build';
import type { PrefGroup } from './groups';
import { orderPrefGroup, resolveOrder } from './order';

const run: PrefActions = { kind: 'actions', name: 'Run', description: '', default: undefined, group: 'run' };

describe('resolveOrder', () => {
  it('keeps stored keys that still exist, in stored order', () =>
    expect(resolveOrder(['a', 'b', 'c'], ['c', 'x', 'a'], 'schema')).toEqual(['c', 'b', 'a']));
  it('puts a key the store lacks at its schema index', () =>
    expect(resolveOrder(['a', 'n', 'b', 'c'], ['c', 'b', 'a'], 'schema')).toEqual(['c', 'n', 'b', 'a']));
  it("'end' puts a key the store lacks last", () =>
    expect(resolveOrder(['a', 'n', 'b'], ['b', 'a'], 'end')).toEqual(['b', 'a', 'n']));
  it('is the schema order with nothing stored', () =>
    expect(resolveOrder(['a', 'b'], undefined, 'schema')).toEqual(['a', 'b']));
});

describe('orderPrefGroup', () => {
  const group: PrefGroup = {
    name: 'T',
    children: {
      x: pref.number('X', 1),
      g: pref.group('G', { p: pref.number('P', 1), q: pref.number('Q', 2) }),
      y: pref.number('Y', 1),
    },
  };

  it('reorders the top level and a nested group, each by its own path', () => {
    const out = orderPrefGroup(group, { '': ['y', 'g', 'x'], g: ['q', 'p'] });
    expect(Object.keys(out.children)).toEqual(['y', 'g', 'x']);
    expect(Object.keys((out.children.g as PrefGroup).children)).toEqual(['q', 'p']);
    expect(Object.keys(group.children)).toEqual(['x', 'g', 'y']);
  });

  it('keeps an untouched subtree identical', () => {
    const out = orderPrefGroup(group, { '': ['y', 'g', 'x'] });
    expect(out.children.g).toBe(group.children.g);
  });

  it('sets an actions leaf’s order from its path', () => {
    const out = orderPrefGroup({ name: 'T', children: { run } }, { run: ['b', 'a'] });
    expect((out.children.run as PrefActions).order).toEqual(['b', 'a']);
  });

  it('returns the same object when there is nothing to apply', () => {
    expect(orderPrefGroup(group, undefined)).toBe(group);
    expect(orderPrefGroup(group, {})).toBe(group);
    expect(orderPrefGroup(group, { '': ['x', 'g', 'y'], nope: ['a'] })).toBe(group);
  });
});
