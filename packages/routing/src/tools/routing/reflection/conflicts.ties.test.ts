import { describe, it, expect } from 'vitest';
import { findConflicts } from './conflicts';
import type { Tool } from '../../types';

const tool = (id: string, views: string[]) =>
  ({ id, bindings: [{ spec: { kind: 'key', key: 'k' }, actionId: id, opts: { views } }] }) as unknown as Tool;

describe('findConflicts: one bucket holding separate ties', () => {
  it('reports each set of bindings that tie with each other, not one conflict naming all', () => {
    const c = findConflicts([tool('a', ['x']), tool('b', ['x']), tool('c', ['y']), tool('d', ['y'])]);
    expect(c.map((x) => x.ownerIds)).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('reports each pair of a chain of ties, never naming two that do not tie', () => {
    const c = findConflicts([tool('a', ['x']), tool('b', ['x', 'y']), tool('c', ['y'])]);
    expect(c.map((x) => x.ownerIds)).toEqual([['a', 'b'], ['b', 'c']]);
  });
});
