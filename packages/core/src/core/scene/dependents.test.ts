import { describe, it, expect } from 'vitest';
import { createDependentsIndex } from './dependents';
import { asNodeId } from './types';

const a = asNodeId('a'), b = asNodeId('b'), c = asNodeId('c');

describe('createDependentsIndex', () => {
  it('records dependents and returns them for each dependency', () => {
    const idx = createDependentsIndex();
    idx.add(c, [a, b]);
    expect([...idx.dependentsOf(a)]).toEqual([c]);
    expect([...idx.dependentsOf(b)]).toEqual([c]);
    expect([...idx.dependentsOf(c)]).toEqual([]);
  });

  it('removes a node from every dependency it registered against', () => {
    const idx = createDependentsIndex();
    idx.add(c, [a, b]);
    idx.remove(c);
    expect([...idx.dependentsOf(a)]).toEqual([]);
    expect([...idx.dependentsOf(b)]).toEqual([]);
  });

  it('walks transitively — a label depending on an edge depending on a node', () => {
    const idx = createDependentsIndex();
    idx.add(b, [a]);   // edge b depends on node a
    idx.add(c, [b]);   // label c depends on edge b
    expect([...idx.transitiveDependentsOf(a)].sort()).toEqual([b, c]);
  });

  it('terminates on a dependency cycle rather than looping forever', () => {
    const idx = createDependentsIndex();
    idx.add(b, [a]);
    idx.add(a, [b]);
    expect([...idx.transitiveDependentsOf(a)].sort()).toEqual([a, b]);
  });

  it('re-registering an id replaces its dependencies rather than accumulating them', () => {
    const idx = createDependentsIndex();
    idx.add(c, [a]);
    idx.add(c, [b]);
    expect([...idx.dependentsOf(a)]).toEqual([]);
    expect([...idx.dependentsOf(b)]).toEqual([c]);
  });

  it('re-registering with an empty list clears the previous registration', () => {
    const idx = createDependentsIndex();
    idx.add(c, [a]);
    idx.add(c, []);
    expect([...idx.dependentsOf(a)]).toEqual([]);
  });

  it('removing a node forgets what it declared but not what declares it', () => {
    const idx = createDependentsIndex();
    idx.add(b, [a]);   // edge b depends on node a
    idx.add(c, [b]);   // label c depends on edge b
    idx.remove(b);
    expect([...idx.dependentsOf(a)]).toEqual([]);
    expect([...idx.transitiveDependentsOf(a)]).toEqual([]);
    // c never stopped depending on b, so removing b must not discard that.
    expect([...idx.dependentsOf(b)]).toEqual([c]);
  });

  it('drops a dependency edge only once the dependent itself is removed', () => {
    const idx = createDependentsIndex();
    idx.add(b, [a]);
    idx.add(c, [b]);
    idx.remove(b);
    idx.remove(c);
    expect([...idx.dependentsOf(b)]).toEqual([]);
  });
});
