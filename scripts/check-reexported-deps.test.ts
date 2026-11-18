import { describe, expect, it } from 'vitest';
import { narrowerDeps } from './check-reexported-deps.mjs';

const reexports = new Map([['@w/prefs', new Map([['@w/prefs-schema', new Set(['pref', 'PrefGroup'])]])]]);
const uses = (entries: [string, string[]][]) => new Map(entries.map(([k, v]) => [k, new Set(v)]));

describe('narrowerDeps', () => {
  it('names the package the names come from when only re-exports are used', () => {
    expect(narrowerDeps(uses([['@w/prefs', ['pref', 'PrefGroup']]]), reexports)).toEqual([
      { dep: '@w/prefs', instead: ['@w/prefs-schema'] },
    ]);
  });

  it('keeps a dependency used for a name of its own, a whole-module import, or a subpath', () => {
    expect(narrowerDeps(uses([['@w/prefs', ['pref', 'openPrefs']]]), reexports)).toEqual([]);
    expect(narrowerDeps(uses([['@w/prefs', ['*']]]), reexports)).toEqual([]);
    expect(narrowerDeps(uses([['@w/prefs', ['pref']], ['@w/prefs/react', ['usePref']]]), reexports)).toEqual([]);
  });
});
