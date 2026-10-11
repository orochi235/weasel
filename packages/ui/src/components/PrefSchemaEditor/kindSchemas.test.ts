import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { BUILTIN_KINDS, attributeSchema, blankLeaf, changeKind, convertLeaf, normalizeAttr } from './kindSchemas';
import { nodeAt } from './schemaEdit';
import { STUB } from './schemaExport';

const num: PrefLeaf = { kind: 'number', name: 'N', description: '', default: 3, min: 0, max: 10, unit: { toDisplay: (v: number) => v } as never } as PrefLeaf;

describe('kindSchemas', () => {
  it('describes a number leaf with base, default and number attributes', () => {
    const { shared, own, readOnly } = attributeSchema(num);
    expect(Object.keys(shared)).toEqual(expect.arrayContaining(['name', 'description', 'hidden']));
    expect(Object.keys(own)).toEqual(['default', 'min', 'max', 'step', 'control', 'endless']);
    expect(own.default).toMatchObject({ kind: 'number', min: 0, max: 10 });
    expect(readOnly.map(([k]) => k)).toEqual(['unit']);
  });

  it('describes what a leaf with a value does when auto, and nothing for a group or an action', () => {
    const { auto, readOnly } = attributeSchema({ ...num, manual: true, autoValue: 4 } as PrefLeaf);
    expect(Object.keys(auto)).toEqual(['manual', 'unpinned', 'autoValue']);
    expect(auto.autoValue).toMatchObject({ kind: 'number', name: 'Auto value', min: 0, max: 10 });
    expect(readOnly.map(([k]) => k)).toEqual(['unit']);
    expect(attributeSchema({ name: 'G', children: {} }).auto).toEqual({});
    expect(attributeSchema(blankLeaf('action')).auto).toEqual({});
    expect(normalizeAttr('autoValue', false)).toBe(false);
    expect(normalizeAttr('manual', false)).toBeUndefined();
  });

  it('describes a group and a section each with a name, a description and how it is drawn, a section with no page', () => {
    const { shared, own } = attributeSchema({ name: 'G', children: {} });
    expect(Object.keys(shared)).toEqual(['name', 'description', 'as']);
    expect(own).toEqual({});
    const section = attributeSchema({ name: 'S', members: {} }).shared;
    expect(Object.keys(section)).toEqual(['name', 'description', 'as']);
    expect((section.as as unknown as { options: Array<{ value: string }> }).options.map((o) => o.value)).toEqual(['tab', 'panel', 'section', 'fragment', 'bar']);
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
    const intentional: Record<string, string[]> = { paint: ['default'], object: ['default'], map: ['default'], union: ['default'], action: ['default', 'run'], alias: ['default'] };
    expect(blankLeaf('action')).toMatchObject({ run: STUB });
    for (const k of BUILTIN_KINDS) {
      const { readOnly } = attributeSchema(blankLeaf(k));
      expect([k, readOnly.map(([key]) => key)]).toEqual([k, intentional[k] ?? []]);
    }
    expect(blankLeaf('enum')).toMatchObject({ default: 'a', options: [{ value: 'a', label: 'A' }] });
    expect(blankLeaf('object')).toMatchObject({ children: {} });
  });

  it('drops an attribute whose value the new kind\'s attribute of that name does not offer', () => {
    const slider = { ...num, control: 'slider' } as PrefLeaf;
    const made = convertLeaf(slider, 'boolean');
    expect(made.leaf).not.toHaveProperty('control');
    expect(made.dropped).toContain('control');
    const toggle = { kind: 'boolean', name: 'B', description: '', default: false, control: 'toggle' } as PrefLeaf;
    expect(convertLeaf(toggle, 'enum')).toMatchObject({ leaf: { control: 'toggle' }, dropped: ['default'] });
  });

  it('changes an object pref and one of its own fields in one go, the field going with the object\'s children', () => {
    const root: PrefGroup = { name: 'R', children: {
      obj: { kind: 'object', name: 'O', description: '', default: {}, children: { x: num } } as PrefLeaf,
    } };
    const made = ['obj', 'obj/x'].reduce((at, path) => changeKind(at, path, 'string').root, root);
    expect(nodeAt(made, 'obj')).toMatchObject({ kind: 'string', name: 'O' });
    expect(nodeAt(made, 'obj')).not.toHaveProperty('children');
    expect(changeKind(root, 'obj/gone', 'string')).toEqual({ root, dropped: [] });
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

  it('describes an action by the key it fires, its button text and its control', () => {
    const action = { kind: 'action', name: 'Undo', description: '', default: undefined, action: 'edit.undo' } as PrefLeaf;
    // The key is an attribute to edit, not something the schema fails to describe.
    const { own, readOnly } = attributeSchema(action);
    expect(Object.keys(own)).toEqual(['action', 'label', 'control']);
    expect(readOnly.map(([key]) => key)).not.toContain('action');
  });
});
