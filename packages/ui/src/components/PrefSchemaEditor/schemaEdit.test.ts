import { describe, expect, it } from 'vitest';
import type { ToolPrefGroup } from '@weasel-js/core';
import { addNode, isValidKey, moveNodes, nodeAt, removeNode, renameKey, setAttribute, uniqueKey } from './schemaEdit';

const enc = { read: () => true, write: (on: boolean) => on };
const ROOT: ToolPrefGroup = {
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
const keys = (root: ToolPrefGroup, path: string | null) => Object.keys((nodeAt(root, path) as ToolPrefGroup).children);

describe('schemaEdit', () => {
  it('finds nodes by dotted path, and the root by null', () => {
    expect(nodeAt(ROOT, 'a.x')).toMatchObject({ name: 'X' });
    expect(nodeAt(ROOT, null)).toBe(ROOT);
    expect(nodeAt(ROOT, 'a.nope')).toBeUndefined();
  });

  it('adds at an index, into a group or an object leaf', () => {
    const next = addNode(ROOT, 'a', 'w', { kind: 'boolean', name: 'W', description: '', default: true }, 1);
    expect(keys(next, 'a')).toEqual(['x', 'w', 'y']);
    expect(keys(addNode(ROOT, 'z', 'k', { name: 'K', children: {} }), 'z')).toEqual(['k']);
    expect(ROOT.children.a).not.toHaveProperty('children.w');
  });

  it('refuses a taken key, a dotted key, and a leaf parent', () => {
    expect(() => addNode(ROOT, 'a', 'x', { name: 'G', children: {} })).toThrow(/taken/);
    expect(isValidKey('a.b')).toBe(false);
    expect(() => addNode(ROOT, 'a', 'a.b', { name: 'G', children: {} })).toThrow(/key/);
    expect(() => addNode(ROOT, 'a.x', 'k', { name: 'G', children: {} })).toThrow(/children/);
  });

  it('removes, and renames in place', () => {
    expect(keys(removeNode(ROOT, 'a.x'), 'a')).toEqual(['y']);
    expect(keys(renameKey(ROOT, 'a.x', 'xx'), 'a')).toEqual(['xx', 'y']);
    expect(() => renameKey(ROOT, 'a.x', 'y')).toThrow(/taken/);
  });

  it('sets and clears an attribute, keeping function-valued siblings by identity', () => {
    const next = setAttribute(ROOT, 'a.y', 'name', 'Why');
    expect(nodeAt(next, 'a.y')).toMatchObject({ name: 'Why' });
    expect((nodeAt(next, 'a.y') as { encoding: unknown }).encoding).toBe(enc);
    expect(nodeAt(setAttribute(ROOT, 'a.x', 'min', undefined), 'a.x')).not.toHaveProperty('min');
    expect(setAttribute(ROOT, null, 'name', 'R').name).toBe('R');
  });

  it('moves across parents at a pre-move index and reports new paths', () => {
    const { root, paths } = moveNodes(ROOT, ['a.y'], { parentPath: null, index: 1 });
    expect(keys(root, null)).toEqual(['a', 'y', 'b', 'z']);
    expect(paths).toEqual(['y']);
  });

  it('counts the index before the move within one parent', () => {
    const { root } = moveNodes(ROOT, ['a'], { parentPath: null, index: 3 });
    expect(keys(root, null)).toEqual(['b', 'z', 'a']);
  });

  it('renames a moved node rather than overwrite a sibling with its key', () => {
    const { root, paths } = moveNodes(ROOT, ['a.x'], { parentPath: 'b', index: 1 });
    expect(keys(root, 'b')).toEqual(['x', 'x2']);
    expect(paths).toEqual(['b.x2']);
    expect(nodeAt(root, 'b.x')).toMatchObject({ name: 'BX' });
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
});
