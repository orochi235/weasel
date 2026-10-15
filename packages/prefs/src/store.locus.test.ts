import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from './groups';
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
    gap: { kind: 'number', name: 'Gap', description: '', default: 4, min: 0, max: 100, splitBy: [MODE, DENSITY] },
    surface: { kind: 'color', name: 'Surface', description: '', default: '#000000', splitBy: [MODE] },
    align: {
      kind: 'enum', name: 'Align', description: '', default: 'tight', splitBy: [MODE],
      options: [{ value: 'tight', label: 'Tight' }, { value: 'loose', label: 'Loose' }],
    },
    name: { kind: 'string', name: 'Name', description: '', default: 'untitled' },
  },
} satisfies PrefGroup;

const byMode = (dark: unknown, light: unknown) => ({ $by: MODE, $of: { dark, light } });
const byDensity = (compact: unknown, roomy: unknown) => ({ $by: DENSITY, $of: { compact, roomy } });

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

  it('tells subscribers a selector change is a change to each leaf split by it, and to no other', () => {
    const { store } = make([['gap', byMode(4, 8)], ['surface', '#111111']]);
    const heard: PrefChange[][] = [];
    store.subscribe((changes) => heard.push(changes));
    store.set(MODE, 'light');
    expect(heard).toEqual([[
      { path: MODE, value: 'light', origin: 'local' },
      { path: 'gap', value: 8, origin: 'local' },
    ]]);
  });

  it('repairs each member against the leaf, drops a key that is no option, and reads a missing one as the default', () => {
    const { store } = make([['gap', { $by: MODE, $of: { dark: 999, sepia: 3 } }]]);
    expect(store.locus('gap')).toEqual({ $by: MODE, $of: { dark: 100 } });
    expect(store.get('gap')).toBe(100);
    store.set(MODE, 'light');
    expect(store.get('gap')).toBe(4);
  });

  it('reads the default for a locus by a selector the leaf may not be split by', () => {
    const { store } = make([['surface', byDensity('#111111', '#222222')]]);
    expect(store.get('surface')).toBe('#000000');
    expect(store.locus('surface')).toBeUndefined();
  });

  it('reads a locus-shaped record as an ordinary bad value on a leaf with no splitBy', () => {
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

  it('replaces the whole value when given a locus', () => {
    const { cache, store } = make([['gap', byMode(4, 8)]]);
    store.set('gap', byMode(1, 2));
    expect(recordValue(cache.get('gap'))).toEqual(byMode(1, 2));
  });

  it('unsets a split leaf whole', () => {
    const { store } = make([['gap', byMode(4, 8)]]);
    store.reset('gap');
    expect(store.isSet('gap')).toBe(false);
    expect(store.locus('gap')).toBeUndefined();
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

  it('writes a member the locus held nothing for', () => {
    const { cache, store } = make([['gap', { $by: MODE, $of: { dark: 4 } }]]);
    store.set('gap', 9, { at: { [MODE]: 'light' } });
    expect(recordValue(cache.get('gap'))).toEqual(byMode(4, 9));
  });

  it('replaces a value that is not split whole', () => {
    const { cache, store } = make([['gap', 4]]);
    store.set('gap', 9, { at: { [MODE]: 'light' } });
    expect(recordValue(cache.get('gap'))).toBe(9);
  });
});

describe('every locus at once', () => {
  it('maps each split path to what it holds, and no other', () => {
    const { store } = make([['gap', byMode(4, 8)], ['surface', '#111111']]);
    expect([...store.loci()]).toEqual([['gap', byMode(4, 8)]]);
    expect(store.loci().get('gap')).toBe(store.locus('gap'));
  });

  it('is the same map until something changes', () => {
    const { store } = make([['gap', byMode(4, 8)]]);
    const before = store.loci();
    expect(store.loci()).toBe(before);
    store.set('name', 'doc');
    expect(store.loci()).not.toBe(before);
    expect(store.loci().get('gap')).toBe(before.get('gap'));
  });
});

describe('split and join', () => {
  it('splits a value by a selector, each option starting where it was, and reads the same', () => {
    const { cache, store } = make([['gap', 12]]);
    store.split('gap', MODE);
    expect(recordValue(cache.get('gap'))).toEqual(byMode(12, 12));
    expect(store.get('gap')).toBe(12);
  });

  it('splits an unset leaf from its default, which sets it', () => {
    const { store } = make();
    store.split('gap', MODE);
    expect(store.locus('gap')).toEqual(byMode(4, 4));
    expect(store.isSet('gap')).toBe(true);
  });

  it('stores a second split in the order of splitBy, whichever came first', () => {
    const { cache, store } = make([['gap', 12]]);
    store.split('gap', DENSITY);
    store.split('gap', MODE);
    expect(recordValue(cache.get('gap'))).toEqual(byMode(byDensity(12, 12), byDensity(12, 12)));
  });

  it('joins back to the member the selector is set to', () => {
    const { cache, store } = make([['gap', byMode(4, 8)], [MODE, 'light']]);
    store.join('gap', MODE);
    expect(recordValue(cache.get('gap'))).toBe(8);
    expect(store.locus('gap')).toBeUndefined();
  });

  it('ignores a split by a selector the leaf does not list, and one of a leaf that lists none', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { cache, store } = make([['surface', '#111111']]);
    store.split('surface', DENSITY);
    store.split('name', MODE);
    expect(recordValue(cache.get('surface'))).toBe('#111111');
    expect(cache.has('name')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
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

describe('a schema whose splitBy names something that cannot be split by', () => {
  it('warns when the store is made, and reads such a leaf as not split', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const schema = {
      name: 'Bad',
      children: {
        on: { kind: 'boolean', name: 'On', description: '', default: true },
        gap: { kind: 'number', name: 'Gap', description: '', default: 4, splitBy: ['on', 'nowhere'] },
      },
    } satisfies PrefGroup;
    const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial: [['gap', { $by: 'on', $of: { true: 1 } }]] });
    const store = createPrefsStore(schema, cache);
    expect(warn.mock.calls.map((call) => call[0])).toEqual([
      '[prefs] splitBy of "gap": "on" names a boolean leaf, and only an enum has options to split by',
      '[prefs] splitBy of "gap": "nowhere" names no leaf',
    ]);
    expect(store.get('gap')).toBe(4);
    warn.mockRestore();
  });
});
