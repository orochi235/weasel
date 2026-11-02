import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from './groups';
import { PREF_ELSE } from './scope';
import { recordValue } from './stamp';
import { createPrefsStore, type PrefChange } from './store';

const MODE = 'look.mode';
const DENSITY = 'look.density';

const SCHEMA = {
  name: 'Test',
  children: {
    look: {
      name: 'Look',
      children: {
        mode: {
          kind: 'enum', name: 'Mode', description: '', default: 'dark',
          options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }],
        },
        density: {
          kind: 'enum', name: 'Density', description: '', default: 'compact',
          options: [{ value: 'compact', label: 'Compact' }, { value: 'roomy', label: 'Roomy' }],
        },
      },
    },
    gap: { kind: 'number', name: 'Gap', description: '', default: 4, min: 0, max: 100, scopes: [{ selector: MODE }, { selector: DENSITY }] },
    surface: { kind: 'color', name: 'Surface', description: '', default: '#000000', scopes: [{ selector: MODE }] },
    align: {
      kind: 'enum', name: 'Align', description: '', default: 'tight', scopes: [{ selector: MODE }],
      options: [{ value: 'tight', label: 'Tight' }, { value: 'loose', label: 'Loose' }],
    },
    name: { kind: 'string', name: 'Name', description: '', default: 'untitled' },
  },
} satisfies PrefGroup;

const byMode = (dark: unknown, light: unknown) => ({ $by: MODE, $in: { dark, light } });
const byDensity = (compact: unknown, roomy: unknown) => ({ $by: DENSITY, $in: { compact, roomy } });
const shared = (by: string, value: unknown, own: Record<string, unknown> = {}) => ({ $by: by, $in: own, [PREF_ELSE]: value });

const make = (initial: [string, unknown][] = []) => {
  const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial });
  return { cache, store: createPrefsStore(SCHEMA, cache) };
};

describe('a split value in a store', () => {
  it('reads the member the selector is set to, and the other once the selector changes', () => {
    const { store } = make([['gap', byMode(4, 8)]]);
    expect(store.get('gap')).toBe(4);
    expect(store.values().gap).toBe(4);
    store.set(MODE, 'light');
    expect(store.get('gap')).toBe(8);
    expect(store.values().gap).toBe(8);
  });

  it('tells subscribers a selector change is a change to each leaf split by it, unset ones too, and to no other', () => {
    const { store } = make([['gap', byMode(4, 8)], ['surface', '#111111']]);
    const heard: PrefChange[][] = [];
    store.subscribe((changes) => heard.push(changes));
    store.set(MODE, 'light');
    expect(heard).toEqual([[
      { path: MODE, value: 'light', origin: 'local' },
      { path: 'gap', value: 8, origin: 'local' },
      { path: 'align', value: 'tight', origin: 'local' },
    ]]);
  });

  it('repairs each member against the leaf, drops a key that is no option, and reads a missing one as the default', () => {
    const { store } = make([['gap', { $by: MODE, $in: { dark: 999, sepia: 3 } }]]);
    expect(store.scope('gap')).toEqual({ $by: MODE, $in: { dark: 100 } });
    expect(store.get('gap')).toBe(100);
    store.set(MODE, 'light');
    expect(store.get('gap')).toBe(4);
  });

  it('reads the default for a scope by a selector the leaf may not be split by', () => {
    const { store } = make([['surface', byDensity('#111111', '#222222')]]);
    expect(store.get('surface')).toBe('#000000');
    expect(store.scope('surface')).toBeUndefined();
  });

  it('reads a scope-shaped record as an ordinary bad value on a leaf with no scopes', () => {
    const { store } = make([['name', byMode('a', 'b')]]);
    expect(store.get('name')).toBe('untitled');
  });

  it('writes the member the selectors name, and leaves the others', () => {
    const { cache, store } = make([['gap', byMode(byDensity(4, 8), 6)], [DENSITY, 'roomy']]);
    store.set('gap', 10);
    expect(recordValue(cache.get('gap'))).toEqual(byMode(byDensity(4, 10), 6));
    expect(store.get('gap')).toBe(10);
    store.set(MODE, 'light');
    store.set('gap', 7);
    expect(recordValue(cache.get('gap'))).toEqual(byMode(byDensity(4, 10), 7));
  });

  it('replaces the whole value when given a scope', () => {
    const { cache, store } = make([['gap', byMode(4, 8)]]);
    store.set('gap', byMode(1, 2));
    expect(recordValue(cache.get('gap'))).toEqual(byMode(1, 2));
  });

  it('unsets a split leaf whole, back to an empty scope per selector', () => {
    const { store } = make([['gap', byMode(4, 8)]]);
    store.reset('gap');
    expect(store.isSet('gap')).toBe(false);
    expect(store.scope('gap')).toEqual({ $by: MODE, $in: {}, [PREF_ELSE]: { $by: DENSITY, $in: {} } });
  });
});

describe('a write at a stated selection', () => {
  it('writes the member the selection names, whatever the selectors are set to', () => {
    const { cache, store } = make([['gap', byMode(byDensity(4, 8), byDensity(5, 9))]]);
    store.set('gap', 20, { at: { [MODE]: 'light', [DENSITY]: 'roomy' } });
    expect(recordValue(cache.get('gap'))).toEqual(byMode(byDensity(4, 8), byDensity(5, 20)));
    expect(store.get('gap')).toBe(4);
    expect(store.get(MODE)).toBe('dark');
  });

  it('keeps the own value of a selector the selection leaves out, and ignores an option the selector lacks', () => {
    const { cache, store } = make([['gap', byMode(byDensity(4, 8), 6)], [DENSITY, 'roomy']]);
    store.set('gap', 11, { at: { [MODE]: 'dark' } });
    expect(recordValue(cache.get('gap'))).toEqual(byMode(byDensity(4, 11), 6));
    store.set('gap', 12, { at: { [MODE]: 'sepia' } });
    expect(recordValue(cache.get('gap'))).toEqual(byMode(byDensity(4, 12), 6));
  });

  it('writes a member the scope held nothing for', () => {
    const { cache, store } = make([['gap', { $by: MODE, $in: { dark: 4 } }]]);
    store.set('gap', 9, { at: { [MODE]: 'light' } });
    expect(recordValue(cache.get('gap'))).toEqual(byMode(4, 9));
  });

  it('keeps a plain value as the shared one when it writes an option', () => {
    const { cache, store } = make([['gap', 4]]);
    store.set('gap', 9, { at: { [MODE]: 'light' } });
    expect(recordValue(cache.get('gap'))).toEqual(shared(MODE, 4, { light: 9 }));
  });
});

describe('every scope at once', () => {
  it('maps each split path to what it holds, and no other', () => {
    const { store } = make([['gap', byMode(4, 8)], ['surface', '#111111']]);
    expect([...store.scopes()]).toEqual([['gap', byMode(4, 8)], ['align', { $by: MODE, $in: {} }]]);
    expect(store.scopes().get('gap')).toBe(store.scope('gap'));
  });

  it('is the same map until something changes', () => {
    const { store } = make([['gap', byMode(4, 8)]]);
    const before = store.scopes();
    expect(store.scopes()).toBe(before);
    store.set('name', 'doc');
    expect(store.scopes()).not.toBe(before);
    expect(store.scopes().get('gap')).toBe(before.get('gap'));
  });
});

describe('a stored value whose shape the scopes do not declare', () => {
  it('reads a plain value as the shared one, and on the first write keeps it as that', () => {
    const { cache, store } = make([['gap', 12]]);
    expect(store.get('gap', { at: { [MODE]: 'light', [DENSITY]: 'roomy' } })).toBe(12);
    store.set('gap', 3, { at: { [MODE]: 'light' } });
    expect(recordValue(cache.get('gap'))).toEqual(shared(MODE, 12, { light: 3 }));
    expect(store.get('gap')).toBe(12);
  });

  it('reads a value split by a selector at another level as it is, and the first write flattens it to what reads now', () => {
    const { cache, store } = make([['gap', byDensity(4, 8)], [DENSITY, 'roomy']]);
    expect(store.get('gap')).toBe(8);
    expect(store.get('gap', { at: { [DENSITY]: 'compact' } })).toBe(4);
    store.set('gap', 1, { at: { [MODE]: 'light' } });
    expect(recordValue(cache.get('gap'))).toEqual(shared(MODE, 8, { light: 1 }));
    expect(store.get('gap', { at: { [DENSITY]: 'compact' } })).toBe(8);
  });

  it('keeps a value split as declared, and writes into an own value that is split by the next selector in', () => {
    const { cache, store } = make([['gap', byMode(byDensity(4, 8), 6)]]);
    store.set('gap', 5, { at: { [MODE]: 'dark', [DENSITY]: 'compact' } });
    expect(recordValue(cache.get('gap'))).toEqual(byMode(byDensity(5, 8), 6));
  });
});

describe('reading under weights', () => {
  it('blends a number by the weights given, and leaves the stored value and the plain read alone', () => {
    const { store } = make([['gap', byMode(4, 8)]]);
    expect(store.get('gap', { weights: { [MODE]: { dark: 0.25, light: 0.75 } } })).toBe(7);
    expect(store.get('gap')).toBe(4);
  });

  it('multiplies weights across two selectors, a selector left out keeping its own value', () => {
    const { store } = make([['gap', byMode(byDensity(4, 8), 6)]]);
    const mode = { dark: 0.5, light: 0.5 };
    expect(store.get('gap', { weights: { [MODE]: mode } })).toBe(5);
    expect(store.get('gap', { weights: { [MODE]: mode, [DENSITY]: { compact: 0.5, roomy: 0.5 } } })).toBe(6);
  });

  it('gives a kind that cannot blend its heaviest member, the first option on a tie', () => {
    const { store } = make([['align', byMode('tight', 'loose')]]);
    expect(store.get('align', { weights: { [MODE]: { dark: 0.25, light: 0.75 } } })).toBe('loose');
    expect(store.get('align', { weights: { [MODE]: { light: 0.5, dark: 0.5 } } })).toBe('tight');
  });

  it('reads a leaf that is not split the same under any weights', () => {
    const { store } = make([['name', 'doc']]);
    expect(store.get('name', { weights: { [MODE]: { dark: 0.5, light: 0.5 } } })).toBe('doc');
  });

  it('uses a blend given for a kind', () => {
    const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial: [['gap', byMode(4, 8)]] });
    const store = createPrefsStore(SCHEMA, cache, undefined, undefined, 0, { number: () => -1 });
    expect(store.get('gap', { weights: { [MODE]: { dark: 0.5, light: 0.5 } } })).toBe(-1);
  });
});

describe('values at a selection', () => {
  it('is the tree as it would read with the selectors set as given, the selectors included', () => {
    const { store } = make([['gap', byMode(byDensity(4, 8), 6)], ['name', 'doc']]);
    expect(store.values({ at: { [MODE]: 'light' } })).toMatchObject({ look: { mode: 'light', density: 'compact' }, gap: 6, name: 'doc' });
    expect(store.values({ at: { [DENSITY]: 'roomy' } })).toMatchObject({ look: { mode: 'dark', density: 'roomy' }, gap: 8 });
    expect(store.get(MODE)).toBe('dark');
  });

  it('ignores an option the selector does not have', () => {
    const { store } = make([['gap', byMode(5, 8)]]);
    expect(store.values({ at: { [MODE]: 'sepia' } }).gap).toBe(5);
  });
});

describe('a schema whose scopes name something that cannot be split by', () => {
  it('warns when the store is made, and reads such a leaf as not split', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const schema = {
      name: 'Bad',
      children: {
        on: { kind: 'boolean', name: 'On', description: '', default: true },
        gap: { kind: 'number', name: 'Gap', description: '', default: 4, scopes: [{ selector: 'on' }, { selector: 'nowhere' }] },
      },
    } satisfies PrefGroup;
    const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial: [['gap', { $by: 'on', $in: { true: 1 } }]] });
    const store = createPrefsStore(schema, cache);
    expect(warn.mock.calls.map((call) => call[0])).toEqual([
      '[prefs] scopes of "gap": "on" names a boolean leaf, and only an enum has options to split by',
      '[prefs] scopes of "gap": selector "nowhere" is not admitted by this schema (it admits none)',
    ]);
    expect(store.get('gap')).toBe(4);
    warn.mockRestore();
  });
});

describe('a split value stored as { $by, $of }, before its members were keyed $in', () => {
  it('reads as $in, and is written back as $in', () => {
    const old = { $at: 0, value: { $by: MODE, $of: { dark: { $by: DENSITY, $of: { compact: 4, roomy: 5 } }, light: 8 } } };
    const { cache, store } = make([['gap', old]]);
    expect(store.scope('gap')).toEqual(byMode(byDensity(4, 5), 8));
    expect(store.get('gap')).toBe(4);
    store.set('gap', 6, { at: { [MODE]: 'light' } });
    expect(cache.get('gap')).toEqual({ $at: 0, value: byMode(byDensity(4, 5), 6) });
  });

  it('upgrades an unstamped record too, and leaves a value that is not split alone', () => {
    const { cache, store } = make([['gap', { $by: MODE, $of: { dark: 3 } }], ['name', 'x']]);
    expect(store.get('gap')).toBe(3);
    store.set('gap', 4, { at: { [MODE]: 'light' } });
    expect(recordValue(cache.get('gap'))).toEqual(byMode(3, 4));
    expect(store.get('name')).toBe('x');
  });
});
