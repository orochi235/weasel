import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { dropDrawnPath, dropPlacedPath, dropValuePath, isDropPath, isDropTop, withDrop, type PrefDrop } from './drop';

const leaf = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false });
const ROOT: PrefGroup = {
  name: '',
  children: {
    canvas: { name: 'Canvas', children: { a: leaf('A'), b: leaf('B'), box: { name: 'Box', children: { c: leaf('C') } } } },
    io: { name: 'IO', children: { d: leaf('D') } },
  },
};
const NEW = leaf('New');

/** The names a group draws, in order, a nested group as its name and its own list. */
const names = (group: PrefGroup): unknown[] =>
  Object.values(group.children).map((c) => (isPrefLeaf(c) ? c.name : [c.name, names(c)]));

describe('withDrop', () => {
  it('sets a new node beside the leaf at the mark, or at the end of the group there', () => {
    expect(names(withDrop(ROOT, { path: 'canvas.b', where: 'before', nodes: [NEW] }))[0]).toEqual(['Canvas', ['A', 'New', 'B', ['Box', ['C']]]]);
    expect(names(withDrop(ROOT, { path: 'canvas.b', where: 'after', nodes: [NEW] }))[0]).toEqual(['Canvas', ['A', 'B', 'New', ['Box', ['C']]]]);
    expect(names(withDrop(ROOT, { path: 'canvas.box', where: 'into', nodes: [NEW] }))[0]).toEqual(['Canvas', ['A', 'B', ['Box', ['C', 'New']]]]);
    expect(names(withDrop(ROOT, { path: '', where: 'into', nodes: [NEW] })).at(-1)).toBe('New');
  });

  it('takes a node of the form out of where it was, also when the mark is the node itself', () => {
    const a = (ROOT.children.canvas as PrefGroup).children.a!;
    expect(names(withDrop(ROOT, { path: 'io.d', where: 'after', nodes: [a], from: ['canvas.a'] }))).toEqual([['Canvas', ['B', ['Box', ['C']]]], ['IO', ['D', 'A']]]);
    expect(names(withDrop(ROOT, { path: 'canvas.a', where: 'before', nodes: [a], from: ['canvas.a'] }))[0]).toEqual(['Canvas', ['A', 'B', ['Box', ['C']]]]);
  });

  it('leaves the given tree as it was', () => {
    const before = JSON.stringify(ROOT);
    withDrop(ROOT, { path: 'canvas.b', where: 'before', nodes: [NEW] });
    expect(JSON.stringify(ROOT)).toBe(before);
  });
});

describe('a placeholder path', () => {
  const drop: PrefDrop = { path: 'io.d', where: 'after', nodes: [ROOT.children.canvas!], from: ['canvas'] };
  const placed = dropPlacedPath(drop, 0);

  it('is told from a path of the schema, and its own from one inside it', () => {
    expect(isDropPath('canvas.a')).toBe(false);
    expect(isDropPath(placed)).toBe(true);
    expect(isDropTop(placed)).toBe(true);
    expect(isDropTop(`${placed}.a`)).toBe(false);
    expect(dropPlacedPath({ path: 'io', where: 'into' }, 0).startsWith('io.')).toBe(true);
    expect(dropPlacedPath({ path: 'io', where: 'before' }, 0).includes('.')).toBe(false);
  });

  it('maps to the path its node was dragged from, and back', () => {
    expect(dropValuePath(drop, `${placed}.box.c`)).toBe('canvas.box.c');
    expect(dropValuePath(drop, 'io.d')).toBe('io.d');
    expect(dropValuePath({ ...drop, from: undefined }, placed)).toBe(placed);
    expect(dropDrawnPath(drop, 'canvas')).toBe(placed);
    expect(dropDrawnPath(drop, 'canvas.box')).toBe(`${placed}.box`);
    expect(dropDrawnPath(drop, 'io')).toBe('io');
    expect(dropDrawnPath(null, 'io')).toBe('io');
  });
});
