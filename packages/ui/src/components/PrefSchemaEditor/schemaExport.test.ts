import { describe, expect, it } from 'vitest';
import type { ToolPrefGroup } from '@weasel-js/core';
import { diffSchemas, formatChanges, KEEP, printSchema } from './schemaExport';
import { moveNodes, renameKey, setAttribute } from './schemaEdit';

const ROOT: ToolPrefGroup = {
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
    let next = setAttribute(ROOT, 'a.x', 'min', 5);
    next = renameKey(next, 'a.e', 'mode');
    next = moveNodes(next, ['odd-key'], { parentPath: null, index: 0 }).root;
    const changes = diffSchemas(ROOT, next);
    expect(changes).toContainEqual({ op: 'attr', path: 'a.x', key: 'min', from: 0, to: 5 });
    expect(changes).toContainEqual({ op: 'move', from: 'a.e', to: 'a.mode' });
    expect(changes).toContainEqual({ op: 'reorder', path: '' });
  });

  it('carries a moved group\'s children with it instead of reporting each', () => {
    const next = moveNodes(
      { name: 'R', children: { g: { name: 'G', children: { k: { kind: 'string', name: 'K', description: '', default: '' } } }, h: { name: 'H', children: {} } } },
      ['g'], { parentPath: 'h', index: 0 },
    ).root;
    const changes = diffSchemas({ name: 'R', children: { g: { name: 'G', children: { k: { kind: 'string', name: 'K', description: '', default: '' } } }, h: { name: 'H', children: {} } } }, next);
    expect(changes).toEqual([{ op: 'move', from: 'g', to: 'h.g' }]);
  });

  it('does not report a function attribute that kept its identity', () => {
    const next = setAttribute(ROOT, 'odd-key', 'name', 'Bee');
    expect(diffSchemas(ROOT, next)).toEqual([{ op: 'attr', path: 'odd-key', key: 'name', from: 'B', to: 'Bee' }]);
  });

  it('formats one line per change', () => {
    expect(formatChanges([
      { op: 'add', path: 'a.n', kind: 'number' },
      { op: 'remove', path: 'a.o', kind: 'group' },
      { op: 'move', from: 'a.e', to: 'a.mode' },
      { op: 'attr', path: 'a.x', key: 'min', from: 0, to: 5 },
    ])).toBe(['+ a.n  (number)', '− a.o  (group)', '↕ a.e → a.mode', '~ a.x.min  0 → 5'].join('\n'));
  });
});
