import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it } from 'vitest';
import type { PrefGroup } from './groups';
import { PREF_ELSE } from './scope';
import { recordValue } from './stamp';
import { createPrefsStore } from './store';

const option = (value: string) => ({ value, label: value });
const SCHEMA = {
  name: 'Test',
  admits: ['layout'],
  children: {
    mode: { kind: 'enum', name: 'Mode', description: '', default: 'dark', options: [option('dark'), option('light'), option('types')] },
    density: { kind: 'enum', name: 'Density', description: '', default: 'compact', options: [option('compact'), option('roomy')] },
    gap: { kind: 'number', name: 'Gap', description: '', default: 4, scopes: [{ selector: 'mode' }] },
    both: { kind: 'number', name: 'Both', description: '', default: 1, scopes: [{ selector: 'mode' }, { selector: 'density' }] },
    limit: { kind: 'number', name: 'Limit', description: '', default: 9, scopes: [{ selector: 'mode', overrides: ['types'] }] },
    ratio: { kind: 'number', name: 'Ratio', description: '', default: 1.1, scopes: [{ selector: 'mode', overrides: { types: 2 } }, { selector: 'layout' }] },
  },
} satisfies PrefGroup;

const shared = (by: string, value: unknown, own: Record<string, unknown> = {}) => ({ $by: by, $in: own, [PREF_ELSE]: value });

const make = (initial: [string, unknown][] = []) => {
  const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial });
  return { cache, store: createPrefsStore(SCHEMA, cache) };
};

describe('an open scope', () => {
  it('keeps an option’s own value from its first write, and the rest read the default', () => {
    const { cache, store } = make();
    expect(store.scope('gap')).toEqual({ $by: 'mode', $in: {} });
    store.set('gap', 7);
    expect(recordValue(cache.get('gap'))).toEqual({ $by: 'mode', $in: { dark: 7 } });
    expect(store.get('gap', { at: { mode: 'light' } })).toBe(4);
  });

  it('reads the shared value, where one is stored, for every untouched option', () => {
    const { store } = make([['gap', shared('mode', 5, { dark: 7 })]]);
    expect(store.get('gap')).toBe(7);
    expect(store.get('gap', { at: { mode: 'light' } })).toBe(5);
  });

  it('stops at an outer option’s own value, so an inner open scope starts under the shared value only', () => {
    const { cache, store } = make();
    store.set('both', 3, { at: { mode: 'light', density: 'roomy' } });
    expect(recordValue(cache.get('both'))).toEqual(shared('mode', { $by: 'density', $in: {} }, { light: 3 }));
    expect(store.get('both', { at: { mode: 'light', density: 'compact' } })).toBe(3);
    expect(store.get('both', { at: { mode: 'dark', density: 'roomy' } })).toBe(1);
  });
});

describe('a closed scope', () => {
  it('keeps an option it names apart, and the rest share one value', () => {
    const { cache, store } = make();
    store.set('limit', 0, { at: { mode: 'types' } });
    store.set('limit', 6, { at: { mode: 'dark' } });
    expect(recordValue(cache.get('limit'))).toEqual(shared('mode', 6, { types: 0 }));
    expect(store.get('limit', { at: { mode: 'light' } })).toBe(6);
  });

  it('holds an open scope inside its shared value', () => {
    const { cache, store } = make();
    expect(store.get('ratio', { at: { mode: 'types' } })).toBe(2);
    store.set('ratio', 0.5, { at: { mode: 'light', layout: 'explorer' } });
    expect(recordValue(cache.get('ratio'))).toEqual(shared('mode', { $by: 'layout', $in: { explorer: 0.5 } }));
    expect(store.get('ratio', { at: { mode: 'dark', layout: 'explorer' } })).toBe(0.5);
    expect(store.get('ratio', { at: { mode: 'dark', layout: 'grid' } })).toBe(1.1);
  });
});
