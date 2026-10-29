import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { BUILTIN_KINDS, attributeSchema, blankLeaf, changeKind, convertLeaf, leafOf, normalizeAttr, type CustomKinds } from './kindSchemas';
import { nodeAt } from './schemaEdit';
import { STUB } from './schemaExport';

const num: PrefLeaf = { kind: 'number', name: 'N', description: '', default: 3, min: 0, max: 10, unit: { toDisplay: (v: number) => v } as never } as PrefLeaf;

describe('kindSchemas', () => {
  it('names the tags of the action a pref fires among what the registry says of it', () => {
    const leaf = { kind: 'action', name: 'Copy', description: '', default: undefined, action: 'copy' } as PrefLeaf;
    const { readOnly } = attributeSchema(leaf, {}, [{ key: 'copy', label: 'Copy', tags: ['clipboard', 'edit'] }]);
    expect(readOnly).toContainEqual(['registered tags', 'clipboard, edit']);
  });

  it('describes a number leaf with base, default and number attributes', () => {
    const { shared, own, readOnly } = attributeSchema(num);
    expect(Object.keys(shared)).toEqual(expect.arrayContaining(['name', 'description', 'tags', 'hidden']));
    expect(Object.keys(own)).toEqual(['default', 'min', 'max', 'step', 'control', 'endless', 'measure']);
    expect(own.default).toMatchObject({ kind: 'number', min: 0, max: 10 });
    expect(readOnly.map(([k]) => k)).toEqual(['unit']);
  });

  it('offers no default for a clearable enum, whose default is always nothing', () => {
    const plain = { kind: 'enum', name: 'E', description: '', default: 'a', options: [{ value: 'a', label: 'A' }] } as PrefLeaf;
    expect(Object.keys(attributeSchema(plain).own)).toContain('default');
    const clearable = { ...plain, default: undefined, clearable: true } as PrefLeaf;
    expect(Object.keys(attributeSchema(clearable).own)).not.toContain('default');
    expect(Object.keys(attributeSchema(clearable).own)).toContain('clearable');
  });

  it('describes what a leaf with a value does when auto, and nothing for a group or an action', () => {
    const { auto, readOnly } = attributeSchema({ ...num, auto: { on: true, value: 4 } } as PrefLeaf);
    expect(Object.keys(auto)).toEqual(['never', 'on', 'value']);
    expect(auto.value).toMatchObject({ kind: 'number', name: 'Auto value', min: 0, max: 10 });
    expect(readOnly.map(([k]) => k)).toEqual(['unit']);
    expect(attributeSchema({ name: 'G', children: {} }).auto).toEqual({});
    expect(attributeSchema(blankLeaf('action')).auto).toEqual({});
  });

  it('describes a group and a section each with a name, a description and how it is drawn, a section with no page', () => {
    const { shared, own } = attributeSchema({ name: 'G', children: {} });
    expect(Object.keys(shared)).toEqual(['name', 'description', 'tags', 'as', 'access', 'showIf', 'enableIf']);
    expect(own).toEqual({});
    const section = attributeSchema({ name: 'S', members: {} }).shared;
    expect(Object.keys(section)).toEqual(['name', 'description', 'tags', 'as', 'access', 'showIf', 'enableIf']);
    expect((section.as as unknown as { options: Array<{ value: string }> }).options.map((o) => o.value)).toEqual(['tab', 'panel', 'section', 'fragment', 'bar', 'menu']);
  });

  it('offers an access letter only where a menu carries one: actions, booleans, labels, aliases, groups and sections', () => {
    const offered = (kind: string) => 'access' in attributeSchema(blankLeaf(kind)).shared;
    for (const kind of ['action', 'boolean', 'label', 'alias']) expect(offered(kind), kind).toBe(true);
    for (const kind of ['number', 'string', 'enum', 'color', 'paint', 'object', 'list', 'map', 'union', 'field', 'actions', 'separator']) {
      expect(offered(kind), kind).toBe(false);
    }
  });

  it('offers readout on a leaf holding a value, and an actions leaf only its group and what it shares with buttons', () => {
    expect(attributeSchema(num).shared.readout).toBeDefined();
    expect(attributeSchema(blankLeaf('action')).shared.readout).toBeUndefined();
    const actions = attributeSchema(blankLeaf('actions'));
    expect(Object.keys(actions.shared)).toEqual(['name', 'description', 'tags', 'hidden', 'showIf', 'enableIf']);
    expect(Object.keys(actions.own)).toEqual(['group']);
    expect((convertLeaf({ ...num, readout: true } as PrefLeaf, 'string').leaf as { readout?: boolean }).readout).toBe(true);
  });

  it('offers what a bar does with cells it has no room for, and offers it of nothing else', () => {
    const bar = attributeSchema({ name: 'G', as: 'bar', children: {} }).shared;
    expect((bar.overflow as unknown as { options: Array<{ value: string }> }).options.map((o) => o.value)).toEqual(['scroll', 'menu']);
    expect(attributeSchema({ name: 'S', as: 'bar', members: {} }).shared.overflow).toBeDefined();
    expect(attributeSchema({ name: 'G', as: 'panel', children: {} }).shared.overflow).toBeUndefined();
  });

  it('offers what a bar starts with, and offers it of nothing else', () => {
    const bar = attributeSchema({ name: 'G', as: 'bar', children: {} }).shared;
    expect((bar.lead as unknown as { options: Array<{ value: string }> }).options.map((o) => o.value)).toEqual(['label', 'icon']);
    expect(attributeSchema({ name: 'G', as: 'panel', children: {} }).shared.lead).toBeUndefined();
  });

  it('offers an icon of a group a bar leads with or opens from a button, and of no other', () => {
    expect(attributeSchema({ name: 'G', as: 'bar', children: {} }).shared.icon).toBeDefined();
    expect(attributeSchema({ name: 'S', as: 'menu', members: {} }).shared.icon).toBeDefined();
    expect(attributeSchema({ name: 'G', as: 'panel', children: {} }).shared.icon).toBeDefined();
    expect(attributeSchema({ name: 'G', as: 'section', children: {} }).shared.icon).toBeUndefined();
    expect(attributeSchema({ name: 'G', children: {} }).shared.icon).toBeUndefined();
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
    const intentional: Record<string, string[]> = { paint: ['default'], object: ['default'], map: ['default'], union: ['default'], action: ['run'] };
    expect(blankLeaf('action')).toMatchObject({ run: STUB });
    for (const k of BUILTIN_KINDS) {
      const { readOnly } = attributeSchema(blankLeaf(k));
      expect([k, readOnly.map(([key]) => key)]).toEqual([k, intentional[k] ?? []]);
    }
    expect(blankLeaf('enum')).toMatchObject({ default: 'a', options: [{ value: 'a', label: 'A' }] });
    expect(blankLeaf('object')).toMatchObject({ children: {} });
  });

  it('offers a label its name, its description, its access letter, and when it is drawn, and a separator only when it is drawn', () => {
    const label = attributeSchema(blankLeaf('label'));
    expect([Object.keys(label.shared), Object.keys(label.own), Object.keys(label.auto)]).toEqual([['name', 'description', 'access', 'hidden', 'showIf'], [], []]);
    const rule = attributeSchema(blankLeaf('separator'));
    expect([Object.keys(rule.shared), Object.keys(rule.own), Object.keys(rule.auto)]).toEqual([['hidden', 'showIf'], [], []]);
    expect(rule.readOnly).toEqual([]);
    expect(label.readOnly).toEqual([]);
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

  describe('a custom kind\'s required attributes', () => {
    const custom: CustomKinds = {
      'registry-enum': {
        default: { kind: 'string', name: 'Default', description: '', default: 'none' },
        source: { kind: 'string', name: 'Source', description: '', default: 'tools', required: true },
        control: { kind: 'string', name: 'Control', description: '', default: '' },
      },
    };

    it('keeps one that is emptied, and still removes an optional one', () => {
      expect(normalizeAttr('source', '', custom['registry-enum']!.source)).toBe('');
      expect(normalizeAttr('control', '', custom['registry-enum']!.control)).toBeUndefined();
    });

    it('seeds them, and a default the kind declares, in a new leaf', () => {
      expect(blankLeaf('registry-enum', custom)).toEqual({ kind: 'registry-enum', name: 'New pref', description: '', default: 'none', source: 'tools' });
      expect(leafOf('registry-enum', undefined, custom)).toMatchObject({ source: 'tools' });
      expect(blankLeaf('data', custom)).toEqual({ kind: 'data', name: 'New pref', description: '', default: undefined });
    });

    it('seeds them in a leaf switched to the kind, and offers its default a row', () => {
      const made = convertLeaf({ kind: 'boolean', name: 'B', description: '', default: true }, 'registry-enum', custom);
      expect(made.leaf).toMatchObject({ kind: 'registry-enum', name: 'B', default: 'none', source: 'tools' });
      expect(Object.keys(attributeSchema(made.leaf, custom).own)).toEqual(['default', 'source', 'control']);
      const kept = convertLeaf({ kind: 'string', name: 'S', description: '', default: 'pen' } as PrefLeaf, 'registry-enum', custom);
      expect(kept.leaf).toMatchObject({ default: 'pen', source: 'tools' });
    });
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

describe('the conditions a node is shown and enabled by', () => {
  const when = { path: 'a.on', is: true };

  it('gives a leaf both, each a condition attribute, and no read-only row for one it holds', () => {
    const { shared, readOnly } = attributeSchema({ ...num, unit: undefined, showIf: when, enableIf: when } as PrefLeaf);
    expect(shared.showIf).toMatchObject({ kind: 'condition', name: 'Shown if' });
    expect(shared.enableIf).toMatchObject({ kind: 'condition', name: 'Enabled if' });
    expect(readOnly.map(([key]) => key)).not.toEqual(expect.arrayContaining(['showIf', 'enableIf']));
  });

  it('lets a leaf made from a type set them, and keeps them off the control its default is edited with', () => {
    const typed = { ...num, unit: undefined, type: 'Size', showIf: when, enableIf: when } as PrefLeaf;
    const { shared, own } = attributeSchema(typed);
    expect(Object.keys(shared)).toEqual(expect.arrayContaining(['showIf', 'enableIf']));
    const custom = attributeSchema({ kind: 'swatch', name: 'S', description: '', default: 'x', type: 'Swatch', showIf: when, enableIf: when } as PrefLeaf);
    expect(custom.own.default).toBeDefined();
    expect(custom.own.default).not.toHaveProperty('showIf');
    expect(custom.own.default).not.toHaveProperty('enableIf');
    expect(own.default).not.toHaveProperty('showIf');
  });

  it('carries them to the kind a leaf is changed to', () => {
    const { leaf, dropped } = convertLeaf({ ...num, unit: undefined, showIf: when, enableIf: when } as PrefLeaf, 'boolean');
    expect(leaf).toMatchObject({ kind: 'boolean', showIf: when, enableIf: when });
    expect(dropped).not.toEqual(expect.arrayContaining(['showIf', 'enableIf']));
  });

  it('removes one that is emptied', () => {
    expect(normalizeAttr('showIf', undefined)).toBeUndefined();
  });
});
