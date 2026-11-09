import { describe, expect, it } from 'vitest';
import type { PrefAction } from './action';
import { checkPrefConditions } from './conditionCheck';
import type { PrefGroup } from './groups';
import type { PrefLeaf } from './schema';
import { applyPrefConditions, applyPrefEntryConditions, prefJudge, prefReader } from './status';

const clear: PrefAction = {
  kind: 'action', name: 'Clear all', description: '', default: undefined, action: 'doc.clear',
  grade: 'danger', shortcut: '⌘⌫', activeIf: { path: 'armed' },
};

const schema = (values: unknown): { schema: PrefGroup; holds: ReturnType<typeof prefJudge> } => {
  const s: PrefGroup = {
    name: '',
    children: {
      armed: { kind: 'boolean', name: 'Armed', description: '', default: false } as PrefLeaf,
      tools: { name: 'Tools', children: { clear } },
    },
  };
  return { schema: s, holds: prefJudge(s, prefReader(s, values)) };
};

describe("an action leaf's activeIf", () => {
  it('names the action in `active` while it holds, and not otherwise', () => {
    const off = schema({});
    expect([...applyPrefConditions(off.schema, off.holds).active]).toEqual([]);
    const on = schema({ armed: true });
    expect([...applyPrefConditions(on.schema, on.holds).active]).toEqual(['tools.clear']);
  });

  it('is asked as activeIf, so a judge over several values can answer it its own way', () => {
    const { schema: s } = schema({});
    const asked: string[] = [];
    applyPrefConditions(s, (_, field) => (asked.push(field), true));
    expect(asked).toEqual(['activeIf']);
  });

  it('is ignored on a leaf that is not an action', () => {
    const s: PrefGroup = { name: '', children: { n: { kind: 'number', name: 'N', description: '', default: 0, activeIf: { path: 'n' } } as PrefLeaf } };
    expect(applyPrefConditions(s, () => true).active.size).toBe(0);
  });

  it("answers in an entry, where it reads the entry's own fields", () => {
    const item = {
      kind: 'object', name: 'Row', description: '', default: {},
      children: { on: { kind: 'boolean', name: 'On', description: '', default: false }, go: { ...clear, activeIf: { from: 'item', path: 'on' } } },
    } as PrefLeaf;
    const s: PrefGroup = { name: '', children: {} };
    const at = (on: boolean) => applyPrefEntryConditions(item, 'rows.0', prefJudge(s, () => undefined, { item, value: { on } })).active;
    expect([...at(true)]).toEqual(['rows.0.go']);
    expect([...at(false)]).toEqual([]);
  });

  it("names no action of a list's item that reads its entry, which the schema's pass has none of", () => {
    const rows = {
      kind: 'list', name: 'Rows', description: '', default: [],
      item: {
        kind: 'object', name: 'Row', description: '', default: {},
        children: { on: { kind: 'boolean', name: 'On', description: '', default: false }, go: { ...clear, activeIf: { from: 'item', path: 'on' } } },
      },
    } as PrefLeaf;
    const s: PrefGroup = { name: '', children: { rows } };
    expect([...applyPrefConditions(s, prefJudge(s, () => undefined)).active]).toEqual([]);
  });

  it("names in an entry only the actions whose activeIf reads it, the rest being the schema's pass's", () => {
    const item = {
      kind: 'object', name: 'Row', description: '', default: {},
      children: { go: { ...clear, activeIf: { path: 'armed' } } },
    } as PrefLeaf;
    const s: PrefGroup = { name: '', children: {} };
    const applied = applyPrefEntryConditions(item, 'rows.0', prefJudge(s, () => false, { item, value: {} }));
    expect([...applied.active]).toEqual([]);
  });

  it('is checked as the other conditions are: a path no leaf holds is a problem', () => {
    const s: PrefGroup = { name: '', children: { clear: { ...clear, activeIf: { path: 'nowhere' } } } };
    expect(checkPrefConditions(s).map((p) => [p.at, p.field, p.code])).toEqual([['clear', 'activeIf', 'no-leaf']]);
  });

  it('survives JSON with grade, shortcut, and every reason', () => {
    const leaf = { ...clear, disabledReason: 'Nothing to clear' };
    expect(JSON.parse(JSON.stringify(leaf))).toEqual(leaf);
  });
});
