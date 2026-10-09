import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from './schema';
import { createPrefsStore, type PrefChange } from './store';

const SCHEMA = {
  name: 'Test',
  children: {
    view: {
      name: 'View',
      children: {
        grid: { kind: 'boolean', name: 'Grid', description: '', default: true },
        density: { kind: 'number', name: 'Density', description: '', default: 72, min: 4, max: 288 },
      },
    },
    name: { kind: 'string', name: 'Name', description: '', default: 'untitled' },
  },
} satisfies PrefGroup;

const make = (initial: [string, unknown][] = [], backing = new Map<string, unknown>()) => {
  const cache = createRecordCache({ storage: createMemoryAdapter(backing), prefix: 'p.', initial });
  return { cache, store: createPrefsStore(SCHEMA, cache) };
};

describe('createPrefsStore', () => {
  it('reads the default for a leaf with no record', () => {
    const { store } = make();
    expect(store.get('view.grid')).toBe(true);
    expect(store.isSet('view.grid')).toBe(false);
  });

  it('reads a stored value, repaired', () => {
    const { store } = make([['view.density', 999], ['name', 'doc']]);
    expect(store.get('view.density')).toBe(288);
    expect(store.get('name')).toBe('doc');
  });

  it('sets a leaf, pinning it even at its default', () => {
    const { store } = make();
    store.set('view.grid', true);
    expect(store.isSet('view.grid')).toBe(true);
    expect(store.unset().has('view.grid')).toBe(false);
  });

  it('writes the value it was given, unrepaired, and reads it repaired', async () => {
    const backing = new Map<string, unknown>();
    const { cache, store } = make([], backing);
    store.set('view.density', 999);
    await cache.flush();
    expect(backing.get('p.view.density')).toBe(999);
    expect(store.get('view.density')).toBe(288);
  });

  it('warns and ignores a set on a path the schema lacks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { cache, store } = make();
    store.set('view.nope' as never, 1 as never);
    expect(cache.has('view.nope')).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('resets one leaf, a subtree, or everything', () => {
    const { store } = make([['view.grid', false], ['view.density', 10], ['name', 'x']]);
    store.reset('view.grid');
    expect(store.isSet('view.grid')).toBe(false);
    expect(store.isSet('view.density')).toBe(true);
    store.reset('view');
    expect(store.isSet('view.density')).toBe(false);
    expect(store.isSet('name')).toBe(true);
    store.reset();
    expect(store.isSet('name')).toBe(false);
  });

  it('builds a resolved value tree and keeps its identity until something changes', () => {
    const { store } = make([['name', 'doc']]);
    const first = store.values();
    expect(first).toEqual({ view: { grid: true, density: 72 }, name: 'doc' });
    expect(store.values()).toBe(first);
    expect(store.unset()).toBe(store.unset());
    store.set('name', 'other');
    expect(store.values()).not.toBe(first);
    expect(store.unset()).toEqual(new Set(['view.grid', 'view.density']));
  });

  it('tells subscribers what changed, with the value readers now see', () => {
    const { store } = make();
    const heard: PrefChange[][] = [];
    const stop = store.subscribe((c) => heard.push(c));
    store.set('view.density', 999);
    stop();
    store.set('name', 'ignored');
    expect(heard).toEqual([[{ path: 'view.density', value: 288, origin: 'local' }]]);
  });

  it('hears a remote change through the cache', () => {
    const backing = new Map<string, unknown>();
    const { store } = make([], backing);
    const peer = createMemoryAdapter(backing);
    const heard: PrefChange[][] = [];
    store.subscribe((c) => heard.push(c));
    void peer.set('p.view.grid', false);
    return vi.waitFor(() => {
      expect(heard).toEqual([[{ path: 'view.grid', value: false, origin: 'remote' }]]);
      expect(store.get('view.grid')).toBe(false);
    });
  });

  it('exposes its schema', () => {
    expect(make().store.schema).toBe(SCHEMA);
  });

  it('writes an infinity as a string and reads it back as the infinity', async () => {
    const schema = {
      name: 'T',
      children: { cap: { kind: 'number', name: 'Cap', description: '', default: 10, endless: 'max' } },
    } satisfies PrefGroup;
    const backing = new Map<string, unknown>();
    const cache = createRecordCache({ storage: createMemoryAdapter(backing), prefix: 'p.' });
    const store = createPrefsStore(schema, cache);
    store.set('cap', Infinity);
    await cache.flush();
    expect(backing.get('p.cap')).toBe('Infinity');
    expect(store.get('cap')).toBe(Infinity);
  });
});
