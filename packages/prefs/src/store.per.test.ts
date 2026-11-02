import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from './groups';
import { TBD_REST_KEY } from './locus';
import { checkPrefSplits } from './splitCheck';
import { recordValue } from './stamp';
import { createPrefsStore } from './store';

const SCHEMA = {
  name: 'Test',
  children: {
    mode: {
      kind: 'enum', name: 'Mode', description: '', default: 'dark',
      options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'types', label: 'Types' }],
    },
    limit: {
      kind: 'number', name: 'Limit', description: '', default: 300000,
      per: [{ selector: 'mode', overrides: { types: 0 } }],
    },
    bare: { kind: 'number', name: 'Bare', description: '', default: 8, per: [{ selector: 'mode', overrides: ['types'] }] },
    width: { kind: 'number', name: 'Width', description: '', default: 1, per: [{ selector: 'document' }] },
    ratio: {
      kind: 'number', name: 'Ratio', description: '', default: 1.1,
      per: [{ selector: 'mode', overrides: { types: 2 } }, { selector: 'layout', overrides: { explorer: 0.3 } }],
    },
  },
} satisfies PrefGroup;

const make = (initial: [string, unknown][] = []) => {
  const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial });
  return { cache, store: createPrefsStore(SCHEMA, cache) };
};

describe('a closed selector in a store', () => {
  it('reads the proposed value for an option it names until one is written, and the default for every other', () => {
    const { store } = make();
    expect(store.get('limit')).toBe(300000);
    store.set('mode', 'types');
    expect(store.get('limit')).toBe(0);
    store.set('limit', 4);
    expect(store.get('limit')).toBe(4);
  });

  it('reads the shared value for an option named with no proposed value until one is written', () => {
    const { store } = make();
    store.set('bare', 3, { at: { mode: 'dark' } });
    expect(store.get('bare', { at: { mode: 'types' } })).toBe(3);
    store.set('bare', 6, { at: { mode: 'types' } });
    expect(store.get('bare', { at: { mode: 'types' } })).toBe(6);
    expect(store.get('bare', { at: { mode: 'dark' } })).toBe(3);
  });

  it('ignores a stored member of an option no longer named, and drops it on the next write', () => {
    const { cache, store } = make([['limit', { $by: 'mode', $in: { dark: 1 }, [TBD_REST_KEY]: 2 }]]);
    expect(store.get('limit')).toBe(2);
    store.set('limit', 5, { at: { mode: 'types' } });
    expect(recordValue(cache.get('limit'))).toEqual({ $by: 'mode', $in: { types: 5 }, [TBD_REST_KEY]: 2 });
  });

  it('writes one shared value for every option it does not list, and leaves a listed one alone', () => {
    const { cache, store } = make();
    store.set('limit', 5);
    expect(store.get('limit', { at: { mode: 'light' } })).toBe(5);
    expect(store.get('limit', { at: { mode: 'types' } })).toBe(0);
    expect(recordValue(cache.get('limit'))).toEqual({ $by: 'mode', $in: {}, [TBD_REST_KEY]: 5 });
  });
});

describe('an open selector that is no leaf', () => {
  it('reads the shared value until an option is written, and keeps that option apart after', () => {
    const { store } = make();
    expect(store.get('width')).toBe(1);
    store.set('width', 7, { at: { document: 'a' } });
    expect(store.get('width', { at: { document: 'a' } })).toBe(7);
    expect(store.get('width', { at: { document: 'b' } })).toBe(1);
    expect(store.get('width')).toBe(1);
  });

  it('writes the shared value with no option named, which every untouched option then starts at', () => {
    const { store } = make();
    store.set('width', 7, { at: { document: 'a' } });
    store.set('width', 3);
    expect(store.get('width', { at: { document: 'b' } })).toBe(3);
    expect(store.get('width', { at: { document: 'a' } })).toBe(7);
    expect(store.values({ at: { document: 'a' } }).width).toBe(7);
  });

  it('keeps every option stored for it, whatever it is called', () => {
    const { store } = make([['width', { $by: 'document', $in: { 'any/repo': 4 } }]]);
    expect(store.locus('width')).toEqual({ $by: 'document', $in: { 'any/repo': 4 } });
    expect(store.get('width', { weights: { document: { 'any/repo': 1 } } })).toBe(4);
  });
});

describe('nested entries in a store', () => {
  it('hold an outer own value whatever the inner selector, and the inner entry under the shared one', () => {
    const { cache, store } = make();
    expect(store.get('ratio', { at: { mode: 'types', layout: 'explorer' } })).toBe(2);
    expect(store.get('ratio', { at: { layout: 'explorer' } })).toBe(0.3);
    expect(store.get('ratio', { at: { layout: 'grid' } })).toBe(1.1);
    store.set('ratio', 0.5, { at: { layout: 'explorer' } });
    expect(recordValue(cache.get('ratio'))).toEqual({
      $by: 'mode', $in: {}, [TBD_REST_KEY]: { $by: 'layout', $in: { explorer: 0.5 } },
    });
  });
});

describe('checking per', () => {
  it('accepts an open selector, and names an option that is none, a selector listed twice, and splitBy beside it', () => {
    const schema = {
      name: 'Bad',
      children: {
        mode: { kind: 'enum', name: 'Mode', description: '', default: 'a', options: [{ value: 'a', label: 'A' }] },
        gap: {
          kind: 'number', name: 'Gap', description: '', default: 1, splitBy: ['mode'],
          per: [{ selector: 'mode', overrides: ['z'] }, { selector: 'doc' }, { selector: 'doc' }],
        },
      },
    } satisfies PrefGroup;
    expect(checkPrefSplits(schema).map((p) => p.problem)).toEqual([
      'a leaf with per may not list splitBy too',
      'its closed list names "z", which is no option of "mode"',
      '"doc" is listed twice',
    ]);
    expect(checkPrefSplits(SCHEMA)).toEqual([]);
  });

  it('warns of nothing for a schema whose rules are sound', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    make();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
