import { describe, expect, it } from 'vitest';
import type { ToolPrefGroup, ToolPrefLeaf } from '@weasel-js/core';
import { attributeSchema, blankLeaf, changeKind, normalizeAttr } from './kindSchemas';
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

  it('makes blank leaves that pass their own attribute schema', () => {
    expect(blankLeaf('enum')).toMatchObject({ kind: 'enum', default: 'a', options: [{ value: 'a', label: 'A' }] });
    expect(blankLeaf('object')).toMatchObject({ kind: 'object', children: {} });
  });
});
