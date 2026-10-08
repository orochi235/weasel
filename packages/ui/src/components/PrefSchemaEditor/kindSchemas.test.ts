import { describe, expect, it } from 'vitest';
import type { ToolPrefGroup, ToolPrefLeaf } from '@weasel-js/core';
import { BUILTIN_KINDS, attributeSchema, blankLeaf, changeKind, normalizeAttr } from './kindSchemas';
import { nodeAt } from './schemaEdit';

const num: ToolPrefLeaf = { kind: 'number', name: 'N', description: '', default: 3, min: 0, max: 10, unit: { toDisplay: (v: number) => v } as never } as ToolPrefLeaf;

describe('kindSchemas', () => {
  it('describes a number leaf with base, default and number attributes', () => {
    const { schema, readOnly } = attributeSchema(num);
    expect(Object.keys(schema.children)).toEqual(expect.arrayContaining(['name', 'description', 'default', 'min', 'max', 'step', 'control', 'hidden']));
    expect(schema.children.default).toMatchObject({ kind: 'number', min: 0, max: 10 });
    expect(readOnly.map(([k]) => k)).toEqual(['unit']);
  });

  it('describes a group with name and description only', () => {
    expect(Object.keys(attributeSchema({ name: 'G', children: {} }).schema.children)).toEqual(['name', 'description']);
  });

  it('uses a custom kind\'s attributes, and treats unknown attributes as read-only', () => {
    const leaf = { kind: 'registry-enum', name: 'R', description: '', default: 'a', source: 'tools', extra: 1 } as ToolPrefLeaf;
    const { schema, readOnly } = attributeSchema(leaf, { 'registry-enum': { source: { kind: 'string', name: 'Source', description: '', default: '' } } });
    expect(schema.children.source).toBeDefined();
    expect(readOnly).toEqual([['default', 'a'], ['extra', 1]]);
  });

  it('drops empty optional attributes and keeps required ones', () => {
    expect(normalizeAttr('min', undefined)).toBeUndefined();
    expect(normalizeAttr('hidden', false)).toBeUndefined();
    expect(normalizeAttr('short', [])).toBeUndefined();
    expect(normalizeAttr('description', '')).toBe('');
    expect(normalizeAttr('min', 0)).toBe(0);
  });

  it('changes kind, keeping base fields and reporting dropped attributes', () => {
    const root: ToolPrefGroup = { name: 'R', children: { n: { ...num, unit: undefined, hidden: true } as ToolPrefLeaf } };
    const { root: next, dropped } = changeKind(root, 'n', 'boolean');
    expect(nodeAt(next, 'n')).toMatchObject({ kind: 'boolean', name: 'N', hidden: true, default: false });
    expect(dropped.sort()).toEqual(['default', 'max', 'min']);
  });

  it('makes blank leaves whose attributes are all described, bar the read-only ones', () => {
    const intentional: Record<string, string[]> = { paint: ['default'], object: ['default'] };
    for (const k of BUILTIN_KINDS) {
      const { readOnly } = attributeSchema(blankLeaf(k));
      expect([k, readOnly.map(([key]) => key)]).toEqual([k, intentional[k] ?? []]);
    }
    expect(blankLeaf('enum')).toMatchObject({ default: 'a', options: [{ value: 'a', label: 'A' }] });
    expect(blankLeaf('object')).toMatchObject({ children: {} });
  });

  it('carries a default only between compatible kinds', () => {
    const root = (leaf: object): ToolPrefGroup => ({ name: 'R', children: { n: { name: 'N', description: '', ...leaf } as ToolPrefLeaf } });
    const to = (leaf: object, kind: string) => {
      const r = changeKind(root(leaf), 'n', kind);
      return { leaf: nodeAt(r.root, 'n') as ToolPrefLeaf, dropped: r.dropped };
    };
    const paint = to({ kind: 'paint', default: { kind: 'solid', color: '#fff' } }, 'object');
    expect(paint.leaf).toMatchObject({ default: {} });
    expect(paint.dropped).toContain('default');
    const en = to({ kind: 'string', default: 'zzz' }, 'enum');
    expect(en.leaf).toMatchObject({ default: 'a' });
    expect(en.dropped).toContain('default');
    expect(to({ kind: 'number', default: 4 }, 'string')).toMatchObject({ leaf: { default: '' }, dropped: ['default'] });
    expect(to({ kind: 'string', default: '#abc' }, 'color')).toMatchObject({ leaf: { default: '#abc' }, dropped: [] });
    expect(to({ kind: 'string', default: 'a' }, 'enum').leaf).toMatchObject({ default: 'a' });
  });

  it('does not mistake inherited names for kinds', () => {
    const leaf = { kind: 'constructor', name: 'C', description: '', default: 1 } as unknown as ToolPrefLeaf;
    expect(attributeSchema(leaf).readOnly).toEqual([['default', 1]]);
    expect(Object.keys(attributeSchema(leaf).schema.children)).not.toContain('min');
  });
});
