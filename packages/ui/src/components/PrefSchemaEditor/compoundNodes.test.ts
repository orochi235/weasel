import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { packDraft, unpackDraft } from './draft';
import { attributeSchema, changeKind } from './kindSchemas';
import {
  addNode, branchPaths, childrenOf, fitsUnder, isFixed, moveNodes, nodeAt, removeNode, renameKey, setAttribute,
} from './schemaEdit';
import { diffSchemas, formatChanges, printSchema } from './schemaExport';

const enc = { read: () => true, write: (on: boolean) => on };
const num = { kind: 'number', name: 'Phase', description: '', default: 0, min: 0 } as const;
const circle = { kind: 'object', name: 'Circle', description: '', default: { r: 1 }, children: { r: { ...num, name: 'R' } } } as const;
const ROOT: PrefGroup = {
  name: 'Root',
  children: {
    phases: { kind: 'list', name: 'Phases', description: '', default: [], item: num },
    flags: {
      kind: 'map', name: 'Flags', description: '', default: {},
      item: { kind: 'boolean', name: 'Flag', description: '', default: false, encoding: enc },
    },
    shape: {
      kind: 'union', name: 'Shape', description: '', tag: 'type', default: { type: 'circle', r: 1 },
      variants: { circle },
    },
    loose: { kind: 'string', name: 'Loose', description: '', default: '' },
  },
};

describe('the nodes under a list, a map and a union', () => {
  it('reaches a list\'s and a map\'s item under `item`, and a union\'s variants by key', () => {
    expect(nodeAt(ROOT, 'phases/item')).toBe(num);
    expect(nodeAt(ROOT, 'flags/item')).toMatchObject({ kind: 'boolean' });
    expect(nodeAt(ROOT, 'shape/circle/r')).toMatchObject({ name: 'R' });
    expect(Object.keys(childrenOf(nodeAt(ROOT, 'shape')!)!)).toEqual(['circle']);
    expect(branchPaths(ROOT)).toEqual(['phases', 'flags', 'shape', 'shape/circle']);
  });

  it('edits an item in place, attribute or kind', () => {
    const next = setAttribute(ROOT, 'phases/item', 'max', 9);
    expect((nodeAt(next, 'phases') as unknown as { item: unknown }).item).toMatchObject({ kind: 'number', max: 9 });
    const { root } = changeKind(ROOT, 'phases/item', 'boolean');
    expect((nodeAt(root, 'phases') as unknown as { item: unknown }).item).toMatchObject({ kind: 'boolean', name: 'Phase', default: false });
  });

  it('holds an item fixed: it cannot be removed, renamed, moved, or joined', () => {
    expect(isFixed(ROOT, 'phases/item')).toBe(true);
    expect(isFixed(ROOT, 'shape/circle')).toBe(false);
    expect(() => removeNode(ROOT, 'phases/item')).toThrow(/fixed/);
    expect(() => renameKey(ROOT, 'phases/item', 'entry')).toThrow(/fixed/);
    expect(() => moveNodes(ROOT, ['phases/item'], { parentPath: null, index: 0 })).toThrow(/fixed/);
    expect(() => moveNodes(ROOT, ['loose'], { parentPath: 'phases', index: 0 })).toThrow(/only its item/);
    expect(() => addNode(ROOT, 'flags', 'extra', num)).toThrow(/only its item/);
  });

  it('takes only object leaves as a union\'s variants', () => {
    const shape = nodeAt(ROOT, 'shape')!;
    expect(fitsUnder(shape, circle)).toBe(true);
    expect(fitsUnder(shape, num)).toBe(false);
    expect(() => addNode(ROOT, 'shape', 'n', num)).toThrow(/variant/);
    const next = addNode(ROOT, 'shape', 'box', { ...circle, name: 'Box' });
    expect(Object.keys((nodeAt(next, 'shape') as unknown as { variants: object }).variants)).toEqual(['circle', 'box']);
  });

  it('renames a variant in the union\'s default along with its key', () => {
    const next = renameKey(ROOT, 'shape/circle', 'round');
    expect(nodeAt(next, 'shape')).toMatchObject({ default: { type: 'round', r: 1 } });
    expect(nodeAt(next, 'shape/round')).toBe(circle);
  });

  it('carries an item from a list to a map, and reports what a kind change drops', () => {
    const { root, dropped } = changeKind(ROOT, 'phases', 'map');
    expect(nodeAt(root, 'phases')).toMatchObject({ kind: 'map', item: num });
    expect(dropped).toEqual(['default']);
    expect(changeKind(ROOT, 'phases', 'string').dropped.sort()).toEqual(['default', 'item']);
  });

  it('leaves what is under a node out of its read-only attributes', () => {
    for (const path of ['phases', 'flags', 'shape']) {
      const keys = attributeSchema(nodeAt(ROOT, path)!).readOnly.map(([key]) => key);
      expect(keys.filter((key) => key === 'item' || key === 'variants')).toEqual([]);
    }
  });

  it('prints an item as one node and variants by key', () => {
    const text = printSchema(ROOT);
    expect(text).toContain("item: {\n        kind: 'number',");
    expect(text).not.toContain('item: {\n        item:');
    expect(text).toContain("variants: {\n        circle: {");
  });

  it('reports a change to an item at the item\'s path, once', () => {
    const changes = diffSchemas(ROOT, setAttribute(ROOT, 'phases/item', 'default', 4));
    expect(formatChanges(changes)).toBe('~ phases/item.default  0 → 4');
  });

  it('brings a draft back with its item, and the code the item held', () => {
    const edited = setAttribute(ROOT, 'flags/item', 'name', 'On');
    const back = unpackDraft(JSON.parse(JSON.stringify(packDraft(edited, ROOT))), ROOT);
    const item = (nodeAt(back, 'flags') as unknown as { item: PrefLeaf & { encoding: unknown } }).item;
    expect(item).toMatchObject({ kind: 'boolean', name: 'On' });
    expect(item.encoding).toBe(enc);
  });
});
