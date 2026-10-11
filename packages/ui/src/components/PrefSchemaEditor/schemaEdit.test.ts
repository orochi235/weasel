import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { addNode, aliasNodes, branchPaths, copyNodes, isValidKey, keyProblem, moveNodes, rebasePaths, nodeAt, removeNode, renameKey, setAttribute, uniqueKey } from './schemaEdit';

const enc = { read: () => true, write: (on: boolean) => on };
const ROOT: PrefGroup = {
  name: 'Root',
  children: {
    a: { name: 'A', children: {
      x: { kind: 'number', name: 'X', description: '', default: 1, min: 0 },
      y: { kind: 'boolean', name: 'Y', description: '', default: false, encoding: enc },
    } },
    b: { name: 'B', children: { x: { kind: 'string', name: 'BX', description: '', default: '' } } },
    z: { kind: 'object', name: 'Z', description: '', default: {}, children: {} },
  },
};
const keys = (root: PrefGroup, path: string | null) => Object.keys((nodeAt(root, path) as PrefGroup).children);

describe('schemaEdit', () => {
  it('finds nodes by path, and the root by null', () => {
    expect(nodeAt(ROOT, 'a/x')).toMatchObject({ name: 'X' });
    expect(nodeAt(ROOT, null)).toBe(ROOT);
    expect(nodeAt(ROOT, 'a/nope')).toBeUndefined();
  });

  it('adds at an index, into a group or an object leaf', () => {
    const next = addNode(ROOT, 'a', 'w', { kind: 'boolean', name: 'W', description: '', default: true }, 1);
    expect(keys(next, 'a')).toEqual(['x', 'w', 'y']);
    expect(keys(addNode(ROOT, 'z', 'k', { name: 'K', members: {} }), 'z')).toEqual(['k']);
    expect(ROOT.children.a).not.toHaveProperty('children.w');
  });

  it('nests a section only under an object leaf or a section, and a group only under a group', () => {
    const headed = addNode(ROOT, 'z', 'k', { name: 'K', members: {} });
    const leaf: PrefLeaf = { kind: 'boolean', name: 'W', description: '', default: true };
    expect(nodeAt(addNode(headed, 'z/k', 'w', leaf), 'z/k')).toEqual({ name: 'K', members: { w: leaf } });
    expect(() => addNode(ROOT, 'z', 'k', { name: 'K', children: {} })).toThrow(/only a section nests here/);
    expect(() => addNode(ROOT, 'a', 'k', { name: 'K', members: {} })).toThrow(/only a group nests here/);
    expect(() => moveNodes(headed, ['b'], { parentPath: 'z/k', index: 0 })).toThrow(/only a section nests here/);
    expect(() => moveNodes(headed, ['z/k'], { parentPath: null, index: 0 })).toThrow(/only a group nests here/);
  });

  it('refuses a taken key, a dotted key, and a leaf parent', () => {
    expect(() => addNode(ROOT, 'a', 'x', { name: 'G', children: {} })).toThrow(/taken/);
    expect(isValidKey('a.b')).toBe(false);
    expect(() => addNode(ROOT, 'a', 'a.b', { name: 'G', children: {} })).toThrow(/key/);
    expect(() => addNode(ROOT, 'a/x', 'k', { name: 'G', children: {} })).toThrow(/children/);
  });

  it('removes, and renames in place', () => {
    expect(keys(removeNode(ROOT, 'a/x'), 'a')).toEqual(['y']);
    expect(keys(renameKey(ROOT, 'a/x', 'xx'), 'a')).toEqual(['xx', 'y']);
    expect(() => renameKey(ROOT, 'a/x', 'y')).toThrow(/taken/);
  });

  it('sets and clears an attribute, keeping function-valued siblings by identity', () => {
    const next = setAttribute(ROOT, 'a/y', 'name', 'Why');
    expect(nodeAt(next, 'a/y')).toMatchObject({ name: 'Why' });
    expect((nodeAt(next, 'a/y') as { encoding: unknown }).encoding).toBe(enc);
    expect(nodeAt(setAttribute(ROOT, 'a/x', 'min', undefined), 'a/x')).not.toHaveProperty('min');
    expect(setAttribute(ROOT, null, 'name', 'R').name).toBe('R');
  });

  it('moves across parents at a pre-move index and reports new paths', () => {
    const { root, paths } = moveNodes(ROOT, ['a/y'], { parentPath: null, index: 1 });
    expect(keys(root, null)).toEqual(['a', 'y', 'b', 'z']);
    expect(paths).toEqual(['y']);
  });

  it('counts the index before the move within one parent', () => {
    const { root } = moveNodes(ROOT, ['a'], { parentPath: null, index: 3 });
    expect(keys(root, null)).toEqual(['b', 'z', 'a']);
  });

  it('hands back the same tree when a move leaves every node where it was', () => {
    expect(moveNodes(ROOT, ['b'], { parentPath: null, index: 1 }).root).toBe(ROOT);
    expect(moveNodes(ROOT, ['b'], { parentPath: null, index: 2 }).root).toBe(ROOT);
    expect(moveNodes(ROOT, ['a/x', 'a/y'], { parentPath: 'a', index: 0 })).toEqual({ root: ROOT, from: ['a/x', 'a/y'], paths: ['a/x', 'a/y'] });
  });

  it('renames a moved node rather than overwrite a sibling with its key', () => {
    const { root, paths } = moveNodes(ROOT, ['a/x'], { parentPath: 'b', index: 1 });
    expect(keys(root, 'b')).toEqual(['x', 'x2']);
    expect(paths).toEqual(['b/x2']);
    expect(nodeAt(root, 'b/x')).toMatchObject({ name: 'BX' });
  });

  it('refuses to move a node into itself', () => {
    expect(() => moveNodes(ROOT, ['a'], { parentPath: 'a', index: 0 })).toThrow(/itself/);
  });

  it('picks the next free key', () => {
    expect(uniqueKey({ x: {} as never, x2: {} as never }, 'x')).toBe('x3');
  });

  it('does not mistake inherited names for keys', () => {
    expect(nodeAt(ROOT, 'constructor')).toBeUndefined();
    expect(uniqueKey({}, 'constructor')).toBe('constructor');
    const leaf = { kind: 'boolean', name: 'C', description: '', default: false } as const;
    expect(keys(addNode(ROOT, null, 'constructor', leaf), null)).toContain('constructor');
  });

  it('says what is wrong with a key, or null', () => {
    const kids = (ROOT.children.a as PrefGroup).children;
    expect(keyProblem(kids, 'x')).toMatch(/"x" is taken here/);
    expect(keyProblem(kids, 'a.b')).toMatch(/"a\.b" is not a valid key/);
    expect(keyProblem(kids, 'constructor')).toBeNull();
    expect(keyProblem(kids, '__proto__')).toMatch(/reserved/);
    expect(keyProblem(kids, 'w')).toBeNull();
  });

  it('reports where each moved node came from', () => {
    const { from, paths } = moveNodes(ROOT, ['a/x', 'a'], { parentPath: 'b', index: 0 });
    expect(from).toEqual(['a']);
    expect(paths).toEqual(['b/a']);
  });

  it('lists every path that holds children', () => {
    expect(branchPaths(ROOT)).toEqual(['a', 'b', 'z']);
  });

  it('rebases paths at and beneath a moved node, leaving the rest', () => {
    const next = rebasePaths(['a', 'a/x', 'ab', 'b'], [['a', 'b/a2'], ['b', 'c']]);
    expect([...next].sort()).toEqual(['ab', 'b/a2', 'b/a2/x', 'c']);
  });
});

describe('copyNodes', () => {
  it('sets a copy at the target and leaves the original, keeping the key where it is free', () => {
    const { root, paths } = copyNodes(ROOT, ['a/y'], { parentPath: 'b', index: 0 });
    expect(paths).toEqual(['b/y']);
    expect(keys(root, 'b')).toEqual(['y', 'x']);
    expect(nodeAt(root, 'b/y')).toBe(nodeAt(ROOT, 'a/y'));
    expect(nodeAt(root, 'a/y')).toBe(nodeAt(ROOT, 'a/y'));
  });

  it('numbers the key of a copy set beside its original', () => {
    const { root, paths } = copyNodes(ROOT, ['a/x'], { parentPath: 'a', index: 1 });
    expect(paths).toEqual(['a/x2']);
    expect(keys(root, 'a')).toEqual(['x', 'x2', 'y']);
  });

  it('copies a group with what is under it, once', () => {
    const { root, paths } = copyNodes(ROOT, ['a', 'a/x'], { parentPath: null, index: 0 });
    expect(paths).toEqual(['a2']);
    expect(nodeAt(root, 'a2/x')).toBe(nodeAt(ROOT, 'a/x'));
  });
});

describe('aliases', () => {
  const aliased = aliasNodes(ROOT, ['a/y'], { parentPath: 'b', index: 0 });

  it('sets an unnamed alias of a leaf at the target, by the path its value lives at', () => {
    expect(aliased.paths).toEqual(['b/y']);
    expect(nodeAt(aliased.root, 'b/y')).toEqual({ kind: 'alias', name: '', description: '', default: undefined, of: 'a.y' });
    expect(nodeAt(aliased.root, 'a/y')).toBe(nodeAt(ROOT, 'a/y'));
  });

  it('refuses to alias a group', () => {
    expect(() => aliasNodes(ROOT, ['a'], { parentPath: 'b', index: 0 })).toThrow(/no leaf at a to alias/);
  });

  it('keeps an alias pointed at a leaf that moves', () => {
    const { root } = moveNodes(aliased.root, ['a/y'], { parentPath: null, index: 0 });
    expect(nodeAt(root, 'b/y')).toMatchObject({ of: 'y' });
  });

  it('keeps an alias pointed at a leaf whose group moves or is renamed', () => {
    const moved = moveNodes(aliased.root, ['a'], { parentPath: 'b', index: 0 }).root;
    expect(nodeAt(moved, 'b/y')).toMatchObject({ of: 'b.a.y' });
    expect(nodeAt(renameKey(aliased.root, 'a', 'view'), 'b/y')).toMatchObject({ of: 'view.y' });
  });

  it('keeps an alias pointed at a leaf that is renamed, and leaves the other aliases alone', () => {
    const both = aliasNodes(aliased.root, ['a/x'], { parentPath: null, index: 0 }).root;
    const renamed = renameKey(both, 'a/y', 'why');
    expect(nodeAt(renamed, 'b/y')).toMatchObject({ of: 'a.why' });
    expect(nodeAt(renamed, 'x')).toBe(nodeAt(both, 'x'));
  });

  it('names a section root\'s leaf by its own key', () => {
    const node: PrefSection = { name: 'Node', members: {
      layout: { name: 'Layout', members: { 'pose.x': { kind: 'number', name: 'X', description: '', default: 0 } } },
      other: { name: 'Other', members: {} },
    } };
    const { root, paths } = aliasNodes(node, ['layout/pose.x'], { parentPath: 'other', index: 0 });
    expect(paths).toEqual(['other/pose_xAlias']);
    expect(nodeAt(root, paths[0]!)).toMatchObject({ kind: 'alias', of: 'pose.x' });
  });
});

describe('a section root', () => {
  const NODE: PrefSection = {
    name: 'Properties',
    members: {
      layout: { name: 'Layout', members: {
        'pose.x': { kind: 'number', name: 'X', description: '', default: 0 },
        'pose.y': { kind: 'number', name: 'Y', description: '', default: 0 },
      } },
      'data.text': { kind: 'string', name: 'Text', description: '', default: '' },
    },
  };
  const members = (root: PrefSection, path: string | null) => Object.keys((nodeAt(root, path) as PrefSection).members);

  it('addresses a leaf whose key holds dots', () => {
    expect(nodeAt(NODE, 'layout/pose.x')).toMatchObject({ name: 'X' });
    expect(nodeAt(NODE, 'data.text')).toMatchObject({ name: 'Text' });
    expect(members(removeNode(NODE, 'layout/pose.x'), 'layout')).toEqual(['pose.y']);
    expect(nodeAt(setAttribute(NODE, 'layout/pose.y', 'default', 4), 'layout/pose.y')).toMatchObject({ default: 4 });
    expect(branchPaths(NODE)).toEqual(['layout']);
  });

  it('takes a dotted key for a leaf and a plain one for a section', () => {
    const leaf: PrefLeaf = { kind: 'number', name: 'W', description: '', default: 0 };
    expect(members(addNode(NODE, 'layout', 'pose.width', leaf), 'layout')).toEqual(['pose.x', 'pose.y', 'pose.width']);
    expect(members(renameKey(NODE, 'layout/pose.x', 'pose.left'), 'layout')).toEqual(['pose.left', 'pose.y']);
    expect(() => addNode(NODE, 'layout', 'pose..width', leaf)).toThrow(/not a valid key/);
    expect(() => addNode(NODE, 'layout', 'pose.__proto__', leaf)).toThrow(/reserved/);
    expect(() => addNode(NODE, null, 'a.b', { name: 'S', members: {} })).toThrow(/not a valid key/);
    expect(() => renameKey(NODE, 'layout', 'a.b')).toThrow(/not a valid key/);
  });

  it('nests sections only', () => {
    expect(members(addNode(NODE, null, 'more', { name: 'More', members: {} }), null)).toEqual(['layout', 'data.text', 'more']);
    expect(() => addNode(NODE, null, 'more', { name: 'More', children: {} })).toThrow(/only a section nests here/);
  });

  it('moves a dotted leaf out of its section, and its descendants with a moved section', () => {
    const out = moveNodes(NODE, ['layout/pose.x'], { parentPath: null, index: 0 });
    expect(out.paths).toEqual(['pose.x']);
    expect(members(out.root, null)).toEqual(['pose.x', 'layout', 'data.text']);
    const nested = addNode(NODE, null, 'more', { name: 'More', members: {} });
    expect(moveNodes(nested, ['layout', 'layout/pose.x'], { parentPath: 'more', index: 0 }).paths).toEqual(['more/layout']);
  });

});
