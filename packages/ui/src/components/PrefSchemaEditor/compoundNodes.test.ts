import { describe, expect, it } from 'vitest';
import { prefType, type PrefGroup, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import { packDraft, unpackDraft } from './draft';
import { attributeSchema, blankLeaf, changeKind, convertLeaf } from './kindSchemas';
import { addNode, branchPaths, childrenOf, nodeAt, setAttribute } from './schemaEdit';
import { diffSchemas, formatChanges, printSchema, STUB } from './schemaExport';
import { entryChoices, kindChoices, typeChoice } from './types';

const enc = { read: () => true, write: (on: boolean) => on };
const lift = (value: unknown) => ({ at: value });
const num = { kind: 'number', name: 'Phase', description: '', default: 0, min: 0 } as const;
const circle = { kind: 'object', name: 'Circle', description: '', default: { r: 1 }, children: { r: { ...num, name: 'R' } } } as const;
const Stop = prefType('GradientStop', {
  kind: 'object', name: 'Stop', description: '', default: { at: 0.5 }, fromScalar: lift,
  children: { at: { ...num, name: 'At' } },
} as PrefObject);
const TYPES = [Stop];

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
    plain: circle,
    stop: { ...Stop, name: 'First stop' },
    loose: { kind: 'string', name: 'Loose', description: '', default: '' },
  },
};

const at = (root: PrefGroup, path: string) => nodeAt(root, path) as unknown as Record<string, unknown>;
const withEntry = (root: PrefGroup, path: string, edit: object) =>
  setAttribute(root, path, 'item', { ...(at(root, path).item as object), ...edit });
const roundTrip = (schema: PrefGroup, types = TYPES) => unpackDraft(JSON.parse(JSON.stringify(packDraft(schema, ROOT, types))), ROOT, types);

describe('a list, a map, a union and a typed leaf in the tree', () => {
  it('shows each as one row, and an object leaf with no type as a branch', () => {
    for (const path of ['phases', 'flags', 'shape', 'stop']) expect(childrenOf(nodeAt(ROOT, path)!)).toBeUndefined();
    expect(nodeAt(ROOT, 'phases/item')).toBeUndefined();
    expect(nodeAt(ROOT, 'plain/r')).toMatchObject({ name: 'R' });
    expect(branchPaths(ROOT)).toEqual(['plain']);
  });

  it('takes nothing under a list or a typed leaf', () => {
    expect(() => addNode(ROOT, 'phases', 'extra', num)).toThrow(/cannot hold children/);
    expect(() => addNode(ROOT, 'stop', 'extra', num)).toThrow(/cannot hold children/);
  });
});

describe('what a leaf and an entry may be', () => {
  it('offers every kind but union, and each type by name', () => {
    expect(kindChoices(['number', 'union', 'list'], TYPES)).toEqual([
      { value: 'number', label: 'number' }, { value: 'list', label: 'list' }, { value: 'type:GradientStop', label: 'GradientStop' },
    ]);
  });

  it('keeps what a leaf already is on the list', () => {
    expect(kindChoices(['number'], [], nodeAt(ROOT, 'shape') as PrefLeaf).at(-1)).toEqual({ value: 'union', label: 'union' });
    expect(kindChoices(['number'], [], nodeAt(ROOT, 'stop') as PrefLeaf).at(-1)).toEqual({ value: 'type:GradientStop', label: 'GradientStop (not registered)' });
  });

  it('offers an entry the kinds one control edits, and the types', () => {
    const values = entryChoices(TYPES).map((c) => c.value);
    expect(values).toContain('number');
    expect(values).toContain('type:GradientStop');
    for (const kind of ['object', 'list', 'map', 'union', 'action']) expect(values).not.toContain(kind);
  });

  it('carries an item from a list to a map, and reports what a kind change drops', () => {
    const { root, dropped } = changeKind(ROOT, 'phases', 'map');
    expect(nodeAt(root, 'phases')).toMatchObject({ kind: 'map', item: num });
    expect(dropped).toEqual(['default']);
    expect(changeKind(ROOT, 'phases', 'string').dropped.sort()).toEqual(['default', 'item']);
  });

  it('makes a leaf a type, keeping its name and taking the type\'s default and fields', () => {
    const { root, dropped } = changeKind(ROOT, 'loose', typeChoice('GradientStop'), {}, TYPES);
    expect(nodeAt(root, 'loose')).toMatchObject({ type: 'GradientStop', kind: 'object', name: 'Loose', default: { at: 0.5 } });
    expect(at(root, 'loose').children).toBe(Stop.children);
    expect(dropped).toEqual(['default']);
  });

  it('makes a typed leaf a plain kind, leaving the type and its fields behind', () => {
    const { leaf, dropped } = convertLeaf(nodeAt(ROOT, 'stop') as PrefLeaf, 'string', {}, TYPES);
    expect(leaf).toEqual({ kind: 'string', name: 'First stop', description: '', default: '' });
    expect(dropped.sort()).toEqual(['children', 'default', 'fromScalar']);
  });
});

describe('the attributes of a list and of a typed leaf', () => {
  it('lists an entry\'s name, its default, and its kind\'s own attributes', () => {
    expect(Object.keys(attributeSchema(nodeAt(ROOT, 'phases')!).entry)).toEqual(['name', 'default', 'min', 'max', 'step', 'control', 'endless']);
    expect(attributeSchema(nodeAt(ROOT, 'loose')!).entry).toEqual({});
  });

  it('lists only a typed entry\'s name and default, the default drawn by the type\'s own control', () => {
    const { entry } = attributeSchema(nodeAt(withEntry(ROOT, 'phases', Stop), 'phases')!);
    expect(Object.keys(entry)).toEqual(['name', 'default']);
    expect(entry.default).toMatchObject({ kind: 'object', name: 'Default', children: Stop.children });
  });

  it('edits only what a typed leaf\'s use sets, and shows none of its type\'s fields', () => {
    const { own, readOnly } = attributeSchema(nodeAt(ROOT, 'stop')!);
    expect(Object.keys(own)).toEqual(['default']);
    expect(readOnly).toEqual([]);
  });

  it('leaves what is inside a leaf out of its read-only attributes', () => {
    for (const path of ['phases', 'flags', 'shape']) {
      const keys = attributeSchema(nodeAt(ROOT, path)!).readOnly.map(([key]) => key);
      expect(keys.filter((key) => key === 'item' || key === 'variants')).toEqual([]);
    }
  });
});

describe('the literal', () => {
  it('prints an item as one node, with its code kept from the source', () => {
    const text = printSchema(ROOT);
    expect(text).toContain("item: {\n        kind: 'number',");
    expect(text).toContain('encoding: KEEP_FROM_SOURCE,');
  });

  it('prints a typed leaf as its type\'s name under what the leaf sets', () => {
    expect(printSchema(ROOT, TYPES)).toContain("stop: {\n      ...GradientStop,\n      name: 'First stop',\n    },");
  });

  it('prints a typed leaf that sets nothing, and a typed entry, as the bare name', () => {
    const text = printSchema(setAttribute(setAttribute(ROOT, 'stop', 'name', 'Stop'), 'phases', 'item', Stop), TYPES);
    expect(text).toContain('stop: GradientStop,');
    expect(text).toContain('item: GradientStop,');
  });

  it('prints an attribute a typed leaf removed as undefined', () => {
    expect(printSchema(setAttribute(ROOT, 'stop', 'fromScalar', undefined), TYPES)).toContain('fromScalar: undefined,');
  });

  it('prints a leaf of a type nobody registered as its literal', () => {
    expect(printSchema(ROOT)).toContain("type: 'GradientStop',");
  });

  it('reports a change to an entry as the list\'s item changed', () => {
    const changes = diffSchemas(ROOT, withEntry(ROOT, 'phases', { default: 4 }));
    expect(formatChanges(changes)).toMatch(/^~ phases\.item {2}\{.*default: 0.*\} → \{.*default: 4.*\}$/);
  });
});

describe('a draft', () => {
  it('comes back with an edited entry, and the code the entry held', () => {
    const back = roundTrip(withEntry(ROOT, 'flags', { name: 'On' }));
    const item = at(back, 'flags').item as Record<string, unknown>;
    expect(item).toMatchObject({ kind: 'boolean', name: 'On' });
    expect(item.encoding).toBe(enc);
  });

  it('holds a typed leaf as its type\'s name and what the leaf sets', () => {
    const next = addNode(ROOT, null, 'second', { ...Stop, name: 'Second stop' });
    const packed = packDraft(next, ROOT, TYPES) as { children: Record<string, unknown> };
    expect(packed.children.second).toEqual({ $type: 'GradientStop', kind: 'object', name: 'Second stop' });
  });

  it('brings a typed leaf the source never held back with its type\'s code', () => {
    const back = roundTrip(addNode(ROOT, null, 'second', { ...Stop, name: 'Second stop' }));
    expect(at(back, 'second')).toMatchObject({ type: 'GradientStop', name: 'Second stop', default: { at: 0.5 } });
    expect(at(back, 'second').fromScalar).toBe(lift);
  });

  it('brings a typed entry back the same way', () => {
    const back = roundTrip(withEntry(ROOT, 'phases', Stop));
    expect((at(back, 'phases').item as Record<string, unknown>).fromScalar).toBe(lift);
  });

  it('keeps an attribute a typed leaf removed removed', () => {
    const back = roundTrip(setAttribute(ROOT, 'stop', 'fromScalar', undefined));
    expect('fromScalar' in at(back, 'stop')).toBe(false);
  });

  it('opens a leaf of a type no longer registered under the type\'s name, with what the draft set', () => {
    const packed = JSON.parse(JSON.stringify(packDraft(ROOT, ROOT, TYPES))) as unknown;
    const back = unpackDraft(packed, ROOT, []);
    expect(at(back, 'stop')).toEqual({ kind: 'object', name: 'First stop', description: '', type: 'GradientStop' });
  });

  it('prints a new action\'s run as the stub it is, and brings it back', () => {
    const next = addNode(ROOT, null, 'wipe', blankLeaf('action'));
    expect(printSchema(next)).toContain('run: () => {},');
    expect(at(roundTrip(next), 'wipe').run).toBe(STUB);
  });
});
