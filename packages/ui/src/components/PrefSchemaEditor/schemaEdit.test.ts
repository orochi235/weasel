import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { addNode, branchPaths, isValidKey, keyProblem, kindOfValue, undescribedValues, moveNodes, rebasePaths, nodeAt, removeNode, renameKey, setAttribute, uniqueKey } from './schemaEdit';

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

describe('undescribedValues', () => {
  const root: PrefGroup = { name: 'R', children: {
    view: { name: 'View', children: { grid: { kind: 'boolean', name: 'Grid', description: '', default: true } } },
    panels: { kind: 'data', name: 'Panels', description: '', default: {} } as PrefLeaf,
  } };

  it('lists stored values no leaf describes, walking objects that are not leaves', () => {
    const stored = { view: { grid: false, zoom: 2 }, panels: { left: { open: true } }, theme: 'dark' };
    expect(undescribedValues(root, stored)).toEqual([
      { path: 'view.zoom', value: 2 },
      { path: 'theme', value: 'dark' },
    ]);
  });

  it('lists nothing when nothing is stored', () => {
    expect(undescribedValues(root, undefined)).toEqual([]);
  });
});

describe('kindOfValue', () => {
  it('reads a kind off a stored value\'s shape', () => {
    expect([true, 3, 'a', '#ff8800', '#ff880080', [1], null].map(kindOfValue)).toEqual(
      ['boolean', 'number', 'string', 'color', 'color', undefined, undefined],
    );
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

  it('lists the values of a stored node that no leaf describes, by node path', () => {
    expect(undescribedValues(NODE, { pose: { x: 1, y: 2, width: 3 }, data: { text: 'a' } })).toEqual([{ path: 'pose.width', value: 3 }]);
  });
});
