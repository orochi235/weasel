import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import { prefsCss } from './css';
import type { PrefGroup } from './groups';
import { recordValue } from './stamp';
import { createPrefsStore } from './store';

const MODE = 'mode';
const DENSITY = 'density';
const byMode = (dark: unknown, light: unknown) => ({ $by: MODE, $in: { dark, light } });

const SCHEMA = {
  name: 'Test',
  children: {
    mode: {
      kind: 'enum', name: 'Mode', description: '', default: 'dark',
      options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }],
    },
    density: {
      kind: 'enum', name: 'Density', description: '', default: 'compact',
      options: [{ value: 'compact', label: 'Compact' }, { value: 'roomy', label: 'Roomy' }],
    },
    gap: {
      kind: 'number', name: 'Gap', description: '', default: 4, min: 0, max: 100,
      scopes: [{ selector: MODE }, { selector: DENSITY }], defaultLocus: byMode(4, 6),
    },
    plain: { kind: 'number', name: 'Plain', description: '', default: 1, scopes: [{ selector: MODE }] },
  },
} satisfies PrefGroup;

const make = (initial: [string, unknown][] = []) => {
  const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial });
  return { cache, store: createPrefsStore(SCHEMA, cache) };
};

describe('a leaf whose default is split', () => {
  it('reads the member the selector is set to while it is unset', () => {
    const { store } = make();
    expect(store.get('gap')).toBe(4);
    store.set(MODE, 'light');
    expect(store.get('gap')).toBe(6);
    expect(store.values().gap).toBe(6);
    expect(store.isSet('gap')).toBe(false);
    expect(store.unset().has('gap')).toBe(true);
  });

  it('holds the default as its scope, and lists it among the scopes', () => {
    const { store } = make();
    expect(store.scope('gap')).toEqual(byMode(4, 6));
    expect([...store.scopes().keys()]).toEqual(['gap', 'plain']);
  });

  it('blends the default members under weights', () => {
    const { store } = make();
    expect(store.get('gap', { weights: { [MODE]: { dark: 0.5, light: 0.5 } } })).toBe(5);
  });

  it('writes the first value into the member the selectors name, and keeps the other default', () => {
    const { store, cache } = make();
    store.set('gap', 9, { at: { [MODE]: 'light' } });
    expect(recordValue(cache.get('gap'))).toEqual(byMode(4, 9));
    expect(store.get('gap')).toBe(4);
  });

  it('writes into the default, an option at a time', () => {
    const { cache, store } = make();
    store.set('gap', 5);
    expect(recordValue(cache.get('gap'))).toEqual(byMode(5, 6));
    expect(store.get('gap', { at: { [MODE]: 'light' } })).toBe(6);
  });

  it('goes back to the split default on reset', () => {
    const { store } = make([['gap', 50]]);
    expect(store.scope('gap')).toBeUndefined();
    store.reset('gap');
    expect(store.scope('gap')).toEqual(byMode(4, 6));
  });

  it('reads default for a member a stored scope leaves out', () => {
    const { store } = make([['gap', { $by: MODE, $in: { light: 9 } }]]);
    expect(store.get('gap')).toBe(4);
  });

  it('writes a block for each option the default tells apart', () => {
    const { store } = make();
    const css = prefsCss(store);
    expect(css).toContain(":where(:root[data-mode='light']) {\n  --mode: light;\n  --gap: 6;");
  });

  it('gives a leaf with no split default an empty scope, which a write fills for the current option', () => {
    const { store, cache } = make();
    store.set('plain', 3);
    expect(recordValue(cache.get('plain'))).toEqual({ $by: MODE, $in: { dark: 3 } });
  });
});

describe('a split default the leaf cannot hold', () => {
  it('warns when the store is made, and reads the plain default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const schema = {
      name: 'Test',
      children: {
        mode: SCHEMA.children.mode,
        gap: { kind: 'number', name: 'Gap', description: '', default: 4, defaultLocus: byMode(4, 6) },
        pad: { kind: 'number', name: 'Pad', description: '', default: 2, scopes: [{ selector: MODE }], defaultLocus: { $by: 'nope', $in: { a: 1 } } },
      },
    } satisfies PrefGroup;
    const store = createPrefsStore(schema, createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.' }));
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      '[prefs] scopes of "gap": its defaultLocus is split by "mode", which its scopes do not name',
      '[prefs] scopes of "pad": its defaultLocus is split by "nope", which its scopes do not name',
    ]);
    expect(store.get('gap')).toBe(4);
    expect(store.scope('gap')).toBeUndefined();
    expect(store.get('pad')).toBe(2);
    warn.mockRestore();
  });
});
