import { describe, expect, it } from 'vitest';
import { checkPrefConditions, type PrefCondition, type PrefGroup, type PrefSection } from '@weasel-js/prefs';
import { packDraft, unpackDraft } from './draft';
import { printSchema } from './schemaExport';

const nested: PrefCondition = {
  all: [
    { path: 'snap.on' },
    { any: [{ path: 'snap.mode', in: ['grid', 'guides'] }, { not: { path: 'snap.size', atLeast: 1, below: 10 } }] },
    { path: 'snap.script', is: null },
    { path: 'snap.fine', isNot: false },
  ],
};

const GROUP: PrefGroup = {
  name: 'Root',
  children: {
    snap: {
      name: 'Snap',
      enableIf: { not: { path: 'locked' } },
      children: {
        on: { kind: 'boolean', name: 'On', description: '', default: false },
        fine: { kind: 'boolean', name: 'Fine', description: '', default: true },
        mode: { kind: 'enum', name: 'Mode', description: '', default: 'grid', options: [{ value: 'grid', label: 'Grid' }, { value: 'guides', label: 'Guides' }] },
        size: { kind: 'number', name: 'Size', description: '', default: 4, enableIf: { path: 'snap.on' } },
        script: { kind: 'string', name: 'Script', description: '', default: '', showIf: { path: 'snap.size', above: 0, atMost: 64 } },
        deep: {
          name: 'Deep',
          as: 'panel',
          showIf: nested,
          enableIf: { any: [{ path: 'snap.mode', is: 'grid' }, { all: [] }] },
          children: { tight: { kind: 'boolean', name: 'Tight', description: '', default: false, showIf: nested, enableIf: { path: 'snap.fine', is: true } } },
        },
      },
    },
    locked: { kind: 'boolean', name: 'Locked', description: '', default: false },
  },
};

const SECTION: PrefSection = {
  name: 'Node',
  showIf: { path: 'data.kind', isNot: null },
  members: {
    'data.kind': { kind: 'string', name: 'Kind', description: '', default: '' },
    look: {
      name: 'Look',
      enableIf: { path: 'data.kind', in: ['rect', 'text'] },
      members: { 'data.fill': { kind: 'color', name: 'Fill', description: '', default: '#000000', showIf: { not: { path: 'data.kind', is: 'text' } } } },
    },
  },
};

const evaluated = (text: string): unknown => new Function(`return (${text});`)();
const throughJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('a schema with nested conditions', () => {
  it.each([['a group schema', GROUP], ['a section schema', SECTION]] as const)('is %s the schema itself can answer', (_name, schema) => {
    expect(checkPrefConditions(schema)).toEqual([]);
  });

  it.each([['a group schema', GROUP], ['a section schema', SECTION]] as const)('prints as a literal that evaluates back equal: %s', (_name, schema) => {
    expect(evaluated(printSchema(schema))).toEqual(schema);
  });

  it.each([['a group schema', GROUP], ['a section schema', SECTION]] as const)('packs to a draft that comes back from JSON equal: %s', (_name, schema) => {
    expect(unpackDraft(throughJson(packDraft(schema, schema)), schema)).toEqual(schema);
  });

  it('comes back from a draft equal when the source it is unpacked against has none of the conditions', () => {
    const bare = throughJson(GROUP);
    const strip = (node: Record<string, unknown>): void => {
      delete node.showIf;
      delete node.enableIf;
      for (const child of Object.values((node.children ?? {}) as Record<string, Record<string, unknown>>)) strip(child);
    };
    strip(bare as unknown as Record<string, unknown>);
    expect(unpackDraft(throughJson(packDraft(GROUP, bare)), bare)).toEqual(GROUP);
  });
});
