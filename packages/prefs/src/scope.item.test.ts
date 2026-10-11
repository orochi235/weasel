import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefSection } from './groups';
import { prefValueAtPath } from './helpers';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import type { PrefLeaf, PrefObject } from './schema';
import { applyPrefConditions, PREF_ENTRY, prefJudge, prefScopeAt } from './scope';

const num = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false }) as PrefLeaf;

const phase = {
  kind: 'object', name: 'Phase', description: '', default: {},
  children: { length: num('Length'), ease: num('Ease', { showIf: { path: 'eased' } }), hold: num('Hold', { enableIf: { path: 'holds' } }) },
} as PrefLeaf;
const schema: PrefGroup = {
  name: '',
  children: {
    eased: flag('Eased'),
    holds: flag('Holds'),
    open: flag('Open'),
    phases: { kind: 'list', name: 'Phases', description: '', default: [], item: phase } as PrefLeaf,
    weights: { kind: 'map', name: 'Weights', description: '', default: {}, item: num('Weight', { enableIf: { path: 'open' } }) } as PrefLeaf,
    runs: { kind: 'list', name: 'Runs', description: '', default: [], item: { kind: 'list', name: 'Run', description: '', default: [], item: num('Step', { enableIf: { path: 'open' } }) } } as PrefLeaf,
  },
};
const over = (values: unknown) => prefJudge(schema, (path) => prefValueAtPath(values, path));
const fieldsOf = (shown: PrefGroup | null): string[] =>
  Object.keys(((shown!.children.phases as PrefList).item as PrefObject).children);

describe("applyPrefConditions over a list's and a map's item", () => {
  it('drops a field of the item whose showIf fails, for every entry', () => {
    expect(fieldsOf(applyPrefConditions(schema, over({ eased: false })).shown)).toEqual(['length', 'hold']);
    expect(fieldsOf(applyPrefConditions(schema, over({ eased: true })).shown)).toEqual(['length', 'ease', 'hold']);
  });

  it("names a disabled field of the item under its leaf's path, the entry's step written as *", () => {
    expect(PREF_ENTRY).toBe('*');
    const { disabled } = applyPrefConditions(schema, over({ eased: true, holds: false, open: true }));
    expect([...disabled]).toEqual(['phases.*.hold']);
  });

  it("names a disabled item itself, a map's and a nested list's as a list's", () => {
    const { disabled } = applyPrefConditions(schema, over({ eased: true, holds: true, open: false }));
    expect([...disabled]).toEqual(['weights.*', 'runs.*.*']);
  });

  it('hands back the schema itself when no item loses anything', () => {
    expect(applyPrefConditions(schema, over({ eased: true, holds: true, open: true })).shown).toBe(schema);
  });

  it('leaves alone a list an app draws itself, which holds no item', () => {
    const bare: PrefGroup = { name: '', children: { globs: { kind: 'list', name: 'Globs', description: '', default: [] } as unknown as PrefLeaf } };
    const judge = prefJudge(bare, () => undefined);
    expect(applyPrefConditions(bare, judge).shown).toBe(bare);
    expect(prefScopeAt(bare, 'globs.0', judge)).toEqual({ shown: true, enabled: true });
  });

  it('walks an item under a section schema, where a key is the whole path', () => {
    const section: PrefSection = { name: '', members: { 'data.phases': (schema.children.phases as PrefLeaf) } };
    const applied = applyPrefConditions(section, prefJudge(section, () => false));
    expect(Object.keys((((applied.shown!.members['data.phases'] as PrefList).item) as PrefObject).children)).toEqual(['length', 'hold']);
    expect([...applied.disabled]).toEqual(['data.phases.*.hold']);
  });
});

describe('prefScopeAt inside an entry', () => {
  it("answers for a field of the item at any entry's step", () => {
    const judge = over({ eased: false, holds: false, open: false });
    expect(prefScopeAt(schema, 'phases.0.hold', judge)).toEqual({ shown: true, enabled: false });
    expect(prefScopeAt(schema, 'phases.*.ease', judge).shown).toBe(false);
    expect(prefScopeAt(schema, 'phases.7.length', judge)).toEqual({ shown: true, enabled: true });
    expect(prefScopeAt(schema, 'weights.left', judge).enabled).toBe(false);
    expect(prefScopeAt(schema, 'runs.2.5', judge).enabled).toBe(false);
    expect((schema.children.weights as PrefMap).item.name).toBe('Weight');
  });
});
