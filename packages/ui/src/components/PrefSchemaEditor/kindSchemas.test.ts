import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { BUILTIN_KINDS, attributeSchema, blankLeaf, changeKind, normalizeAttr } from './kindSchemas';
import { nodeAt } from './schemaEdit';

const num: PrefLeaf = { kind: 'number', name: 'N', description: '', default: 3, min: 0, max: 10, unit: { toDisplay: (v: number) => v } as never } as PrefLeaf;

describe('kindSchemas', () => {
  it('describes a number leaf with base, default and number attributes', () => {
    const { shared, own, readOnly } = attributeSchema(num);
    expect(Object.keys(shared)).toEqual(expect.arrayContaining(['name', 'description', 'hidden']));
    expect(Object.keys(own)).toEqual(['default', 'min', 'max', 'step', 'control', 'endless']);
    expect(own.default).toMatchObject({ kind: 'number', min: 0, max: 10 });
    expect(readOnly.map(([k]) => k)).toEqual(['unit']);
  });

  it('describes a group and a section each with a name, a description and how it is drawn, a section with no page', () => {
    const { shared, own } = attributeSchema({ name: 'G', children: {} });
    expect(Object.keys(shared)).toEqual(['name', 'description', 'as']);
    expect(own).toEqual({});
    const section = attributeSchema({ name: 'S', members: {} }).shared;
    expect(Object.keys(section)).toEqual(['name', 'description', 'as']);
    expect((section.as as unknown as { options: Array<{ value: string }> }).options.map((o) => o.value)).toEqual(['tab', 'panel', 'section']);
  });

  it('uses a custom kind\'s attributes, and treats unknown attributes as read-only', () => {
    const leaf = { kind: 'registry-enum', name: 'R', description: '', default: 'a', source: 'tools', extra: 1 } as PrefLeaf;
    const { own, readOnly } = attributeSchema(leaf, { 'registry-enum': { source: { kind: 'string', name: 'Source', description: '', default: '' } } });
    expect(own.source).toBeDefined();
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
    const root: PrefGroup = { name: 'R', children: { n: { ...num, unit: undefined, hidden: true } as PrefLeaf } };
    const { root: next, dropped } = changeKind(root, 'n', 'boolean');
    expect(nodeAt(next, 'n')).toMatchObject({ kind: 'boolean', name: 'N', hidden: true, default: false });
    expect(dropped.sort()).toEqual(['default', 'max', 'min']);
  });

  it('makes blank leaves whose attributes are all described, bar the read-only ones', () => {
    const intentional: Record<string, string[]> = { paint: ['default'], object: ['default'], list: ['item'], action: ['default', 'run'] };
    for (const k of BUILTIN_KINDS) {
      const { readOnly } = attributeSchema(blankLeaf(k));
      expect([k, readOnly.map(([key]) => key)]).toEqual([k, intentional[k] ?? []]);
    }
    expect(blankLeaf('enum')).toMatchObject({ default: 'a', options: [{ value: 'a', label: 'A' }] });
    expect(blankLeaf('object')).toMatchObject({ children: {} });
  });

  it('carries a default only between compatible kinds', () => {
    const root = (leaf: object): PrefGroup => ({ name: 'R', children: { n: { name: 'N', description: '', ...leaf } as PrefLeaf } });
    const to = (leaf: object, kind: string) => {
      const r = changeKind(root(leaf), 'n', kind);
      return { leaf: nodeAt(r.root, 'n') as PrefLeaf, dropped: r.dropped };
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
    const leaf = { kind: 'constructor', name: 'C', description: '', default: 1 } as unknown as PrefLeaf;
    expect(attributeSchema(leaf).readOnly).toEqual([['default', 1]]);
    expect(Object.keys(attributeSchema(leaf).own)).not.toContain('min');
  });
});
