import { describe, it, expect } from 'vitest';
import { nestGroups } from './groupTree';

const NODES = new Set(['a', 'b', 'c', 'd']);
const nest = (raw: Record<string, string[]>) =>
  nestGroups(Object.entries(raw).map(([id, members]) => ({ id, members })), (id) => NODES.has(id));

describe('nestGroups', () => {
  it('leaves flat groups as they were', () => {
    expect(nest({ G: ['a', 'b'], H: ['c'] })).toEqual([
      { id: 'G', direct: ['a', 'b'], members: ['a', 'b'] },
      { id: 'H', direct: ['c'], members: ['c'] },
    ]);
  });

  it('makes a group named by another its child, and counts the child\'s nodes as the parent\'s', () => {
    expect(nest({ Outer: ['a', 'Inner'], Inner: ['b', 'c'] })).toEqual([
      { id: 'Outer', direct: ['a', 'Inner'], members: ['a', 'b', 'c'] },
      { id: 'Inner', direct: ['b', 'c'], members: ['b', 'c'], parent: 'Outer' },
    ]);
  });

  it('nests whichever order the two are declared in', () => {
    expect(nest({ Inner: ['b'], Outer: ['Inner', 'a'] })).toEqual([
      { id: 'Inner', direct: ['b'], members: ['b'], parent: 'Outer' },
      { id: 'Outer', direct: ['Inner', 'a'], members: ['b', 'a'] },
    ]);
  });

  it('keeps a node in the first group that names it', () => {
    expect(nest({ Outer: ['a', 'Inner'], Inner: ['a', 'b'] })).toEqual([
      { id: 'Outer', direct: ['a', 'Inner'], members: ['a', 'b'] },
      { id: 'Inner', direct: ['b'], members: ['b'], parent: 'Outer' },
    ]);
  });

  it('keeps a group in the first group that names it', () => {
    const out = nest({ P: ['Inner', 'a'], Q: ['Inner', 'c'], Inner: ['b'] });
    expect(out.find((g) => g.id === 'Inner')!.parent).toBe('P');
    expect(out.find((g) => g.id === 'Q')).toEqual({ id: 'Q', direct: ['c'], members: ['c'] });
  });

  it('refuses a membership that would make a group its own ancestor', () => {
    const out = nest({ A: ['a', 'B'], B: ['b', 'A'], C: ['c', 'C'] });
    expect(out).toEqual([
      { id: 'A', direct: ['a', 'B'], members: ['a', 'b'] },
      { id: 'B', direct: ['b'], members: ['b'], parent: 'A' },
      { id: 'C', direct: ['c'], members: ['c'] },
    ]);
  });

  it('drops a group with no node anywhere inside it, and ids that are neither', () => {
    expect(nest({ Outer: ['a', 'Empty', 'nope'], Empty: ['Hollow'], Hollow: [] })).toEqual([
      { id: 'Outer', direct: ['a'], members: ['a'] },
    ]);
  });
});
