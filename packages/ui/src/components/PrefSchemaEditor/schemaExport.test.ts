import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { changedAttributes, changedPaths, diffSchemas, formatChanges, KEEP, printSchema } from './schemaExport';
import { moveNodes, renameKey, setAttribute } from './schemaEdit';

const ROOT: PrefGroup = {
  name: 'Root',
  description: "It's here",
  children: {
    a: { name: 'A', children: {
      x: { kind: 'number', name: 'X', description: '', default: 1, min: 0, unit: { toDisplay: (v: number) => v } as never },
      e: { kind: 'enum', name: 'E', description: '', default: 'p', options: [{ value: 'p', label: 'P' }, { value: 'q', label: 'Q' }] },
    } },
    'odd-key': { kind: 'boolean', name: 'B', description: '', default: true, encoding: { read: () => true, write: (on: boolean) => on } },
  },
};

describe('printSchema', () => {
  it('prints a class instance attribute as KEEP_FROM_SOURCE', () => {
    class Unit { scale = 2; }
    const tree: PrefGroup = { name: 'R', children: { n: { kind: 'number', name: 'N', description: '', default: 1, unit: new Unit() as never } } };
    expect(printSchema(tree)).toContain(`unit: ${KEEP}`);
  });

  it('prints a section inside an object leaf with its members, and names it in a change', () => {
    const leaf = { kind: 'boolean', name: 'W', description: '', default: true } as const;
    const tree: PrefGroup = { name: 'R', children: {
      o: { kind: 'object', name: 'O', description: '', default: {}, children: { s: { name: 'S', members: { w: leaf } } } },
    } };
    const back = new Function(`return (${printSchema(tree)});`)();
    expect(back.children.o.children.s).toEqual({ name: 'S', members: { w: leaf } });
    const bare: PrefGroup = { name: 'R', children: { o: { kind: 'object', name: 'O', description: '', default: {}, children: {} } } };
    expect(diffSchemas(bare, tree)).toEqual([
      { op: 'add', path: 'o/s', kind: 'section' },
      { op: 'add', path: 'o/s/w', kind: 'boolean' },
    ]);
  });

  it('prints a literal that evaluates back to the tree, with code as KEEP_FROM_SOURCE', () => {
    const text = printSchema(ROOT);
    const STUB = Symbol('keep');
    const back = new Function(KEEP, `return (${text});`)(STUB);
    expect(back.description).toBe("It's here");
    expect(back.children.a.children.x.unit).toBe(STUB);
    expect(back.children['odd-key'].encoding).toBe(STUB);
    expect(back.children.a.children.e.options).toEqual([{ value: 'p', label: 'P' }, { value: 'q', label: 'Q' }]);
    expect(Object.keys(back.children)).toEqual(['a', 'odd-key']);
  });

  it('quotes keys that are not identifiers and prints option rows one per line', () => {
    const text = printSchema(ROOT);
    expect(text).toContain("'odd-key': {");
    expect(text).toContain("{ value: 'p', label: 'P' },");
  });
});

describe('diffSchemas', () => {
  it('reports an attribute change, a rename as a move, and a reorder', () => {
    let next = setAttribute(ROOT, 'a/x', 'min', 5);
    next = renameKey(next, 'a/e', 'mode');
    next = moveNodes(next, ['odd-key'], { parentPath: null, index: 0 }).root;
    const changes = diffSchemas(ROOT, next);
    expect(changes).toContainEqual({ op: 'attr', path: 'a/x', key: 'min', from: 0, to: 5 });
    expect(changes).toContainEqual({ op: 'move', from: 'a/e', to: 'a/mode' });
    expect(changes).toContainEqual({ op: 'reorder', path: '' });
  });

  it('carries a moved group\'s children with it instead of reporting each', () => {
    const next = moveNodes(
      { name: 'R', children: { g: { name: 'G', children: { k: { kind: 'string', name: 'K', description: '', default: '' } } }, h: { name: 'H', children: {} } } },
      ['g'], { parentPath: 'h', index: 0 },
    ).root;
    const changes = diffSchemas({ name: 'R', children: { g: { name: 'G', children: { k: { kind: 'string', name: 'K', description: '', default: '' } } }, h: { name: 'H', children: {} } } }, next);
    expect(changes).toEqual([{ op: 'move', from: 'g', to: 'h/g' }]);
    // So the moved group's row is the one marked, and the rows under it are not.
    expect([...changedPaths(changes)]).toEqual(['h/g']);
  });

  it('marks a node under a moved group once that node itself changes', () => {
    const before: PrefGroup = { name: 'R', children: { g: { name: 'G', children: { k: { kind: 'string', name: 'K', description: '', default: '' } } }, h: { name: 'H', children: {} } } };
    const moved = moveNodes(before, ['g'], { parentPath: 'h', index: 0 }).root;
    const changes = diffSchemas(before, setAttribute(moved, 'h/g/k', 'name', 'Kay'));
    expect([...changedPaths(changes)].sort()).toEqual(['h/g', 'h/g/k']);
  });

  it('names the attributes of one node that changed, and its key when a move renamed it', () => {
    const changes = diffSchemas(ROOT, renameKey(setAttribute(setAttribute(ROOT, 'a/x', 'min', 2), null, 'name', 'Top'), 'a/x', 'ex'));
    expect([...changedAttributes(changes, 'a/ex')].sort()).toEqual(['$key', 'min']);
    expect([...changedAttributes(changes, null)]).toEqual(['name']);
    expect([...changedAttributes(changes, 'a/e')]).toEqual([]);
  });

  it('does not report a function attribute that kept its identity', () => {
    const next = setAttribute(ROOT, 'odd-key', 'name', 'Bee');
    expect(diffSchemas(ROOT, next)).toEqual([{ op: 'attr', path: 'odd-key', key: 'name', from: 'B', to: 'Bee' }]);
  });

  it('formats one line per change', () => {
    expect(formatChanges([
      { op: 'add', path: 'a/n', kind: 'number' },
      { op: 'remove', path: 'a/o', kind: 'group' },
      { op: 'move', from: 'a/e', to: 'a/mode' },
      { op: 'attr', path: 'a/x', key: 'min', from: 0, to: 5 },
    ])).toBe(['+ a/n  (number)', '− a/o  (group)', '↕ a/e → a/mode', '~ a/x.min  0 → 5'].join('\n'));
  });
});

describe('a section root', () => {
  const NODE: PrefSection = {
    name: 'Properties',
    members: { layout: { name: 'Layout', members: { 'pose.x': { kind: 'number', name: 'X', description: '', default: 0 } } } },
  };

  it('prints members and quotes a dotted key', () => {
    const literal = printSchema(NODE);
    expect(literal).toContain("'pose.x': {");
    expect(literal).not.toContain('children');
    expect(new Function(`return ${literal}`)()).toEqual(NODE);
  });

  it('names a changed leaf by its section and its key', () => {
    const changes = diffSchemas(NODE, setAttribute(NODE, 'layout/pose.x', 'default', 4));
    expect(formatChanges(changes)).toBe('~ layout/pose.x.default  0 → 4');
  });
});
