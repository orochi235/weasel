import { createMemoryAdapter, createRecordCache, localStorageAdapter } from '@weasel-js/storage';
import { recordValue } from './stamp';
import { describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from './groups';
import { VERSION_RECORD } from './helpers';
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

  it('stores a value stamped with the version it was set at, and reads a stamped or a bare record alike', () => {
    const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial: [['name', 'bare'], ['view.density', { $at: 3, value: 30 }]] });
    const store = createPrefsStore(SCHEMA, cache, undefined, undefined, 3);
    expect(store.get('name')).toBe('bare');
    expect(store.get('view.density')).toBe(30);
    expect(store.stored()).toMatchObject({ name: 'bare', view: { density: 30 } });
    store.set('name', 'doc');
    expect(cache.get('name')).toEqual({ $at: 3, value: 'doc' });
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
    expect(recordValue(backing.get('p.view.density'))).toBe(999);
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

  it('builds the raw stored records as a tree, orphans in and $version out', () => {
    const { store } = make([
      ['view.density', 999],
      ['old.flag', 'kept'],
      [VERSION_RECORD, 3],
    ]);
    const first = store.stored();
    expect(first).toEqual({ view: { density: 999 }, old: { flag: 'kept' } });
    expect(store.stored()).toBe(first);
    store.set('name', 'doc');
    expect(store.stored()).not.toBe(first);
    expect(store.stored()).toEqual({ view: { density: 999 }, old: { flag: 'kept' }, name: 'doc' });
  });

  it('shows a branch over a record of the same name, and never writes into a record', () => {
    const held = { kept: true };
    const { store } = make([['x', held], ['x.y', 1]]);
    expect(store.stored()).toEqual({ x: { y: 1 } });
    expect(held).toEqual({ kept: true });
  });

  it('rebuilds the stored tree and notifies, with no changes, when only an orphan changes', () => {
    const backing = new Map<string, unknown>();
    const { store } = make([], backing);
    const peer = createMemoryAdapter(backing);
    const before = store.stored();
    const values = store.values();
    const heard: PrefChange[][] = [];
    store.subscribe((c) => heard.push(c));
    void peer.set('p.old.flag', 1);
    return vi.waitFor(() => {
      expect(store.stored()).toEqual({ old: { flag: 1 } });
      expect(store.stored()).not.toBe(before);
      expect(store.values()).toBe(values);
      expect(heard).toEqual([[]]);
    });
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

  it('tells the subscribers after one that throws', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store } = make();
    const heard: PrefChange[][] = [];
    store.subscribe(() => {
      throw new Error('boom');
    });
    store.subscribe((c) => heard.push(c));
    expect(() => store.set('view.density', 2)).not.toThrow();
    expect(heard).toHaveLength(1);
    error.mockRestore();
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

  it('stops hearing the cache after close', async () => {
    const { cache, store } = make();
    const heard: PrefChange[][] = [];
    store.subscribe((c) => heard.push(c));
    await store.close();
    cache.set('name', 'late');
    expect(heard).toEqual([]);
  });

  it('says it is closed, stops being writable, and warns once about a write that will not persist', async () => {
    const { store } = make();
    expect(store.closed).toBe(false);
    expect(store.writable).toBe(true);
    await store.close();
    expect(store.closed).toBe(true);
    expect(store.writable).toBe(false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.set('name', 'late');
    store.reset('name');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/closed store.*"name"/);
    warn.mockRestore();
  });

  it('exposes its schema', () => {
    expect(make().store.schema).toBe(SCHEMA);
  });

  it("keeps a leaf's identity when another leaf changes, whatever the validator returns", () => {
    const cache = createRecordCache({
      storage: createMemoryAdapter(),
      prefix: 'p.',
      initial: [['name', { a: 1 }]],
    });
    const store = createPrefsStore(SCHEMA, cache, {
      string: (stored) => (typeof stored === 'object' ? { ...(stored as object) } : stored),
    });
    const before = store.get('name');
    store.set('view.density', 100);
    expect(store.get('name')).toBe(before);
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
    expect(recordValue(backing.get('p.cap'))).toBe('Infinity');
    expect(store.get('cap')).toBe(Infinity);
  });

  it('passes through whether the flush landed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = { ...createMemoryAdapter(), set: () => Promise.reject(new Error('quota')) };
    const ok = make();
    ok.store.set('name', 'doc');
    expect(await ok.store.flush()).toBe(true);
    const cache = createRecordCache({ storage: failing, prefix: 'p.' });
    const store = createPrefsStore(SCHEMA, cache);
    store.set('name', 'doc');
    expect(await store.flush()).toBe(false);
    warn.mockRestore();
  });

  it('writes an infinity inside a list as a string and reads it back', async () => {
    const schema = {
      name: 'T',
      children: {
        caps: { kind: 'list', name: 'Caps', description: '', default: [], item: { kind: 'number', name: 'Cap', description: '', default: 0, endless: 'max' } },
      },
    } satisfies PrefGroup;
    const backing = new Map<string, unknown>();
    const cache = createRecordCache({ storage: createMemoryAdapter(backing), prefix: 'p.' });
    const store = createPrefsStore(schema, cache);
    store.set('caps', [1, Infinity]);
    await cache.flush();
    expect(recordValue(backing.get('p.caps'))).toEqual([1, 'Infinity']);
    expect(store.get('caps')).toEqual([1, Infinity]);
  });

  it('holds nothing for an action leaf', () => {
    const schema = {
      name: 'T',
      children: {
        clear: { kind: 'action', name: 'Clear', description: '', default: undefined, run: () => {} },
        on: { kind: 'boolean', name: 'On', description: '', default: true },
      },
    } satisfies PrefGroup;
    const cache = createRecordCache({ storage: createMemoryAdapter(new Map()), prefix: 'p.' });
    const store = createPrefsStore(schema, cache);
    expect(store.values()).toEqual({ on: true });
  });

  it('writes an infinity inside a map as a string and reads it back', async () => {
    const schema = {
      name: 'T',
      children: {
        caps: { kind: 'map', name: 'Caps', description: '', default: {}, item: { kind: 'number', name: 'Cap', description: '', default: 0, endless: 'max' } },
      },
    } satisfies PrefGroup;
    const backing = new Map<string, unknown>();
    const cache = createRecordCache({ storage: createMemoryAdapter(backing), prefix: 'p.' });
    const store = createPrefsStore(schema, cache);
    store.set('caps', { a: 1, b: Infinity });
    await cache.flush();
    expect(recordValue(backing.get('p.caps'))).toEqual({ a: 1, b: 'Infinity' });
    expect(store.get('caps')).toEqual({ a: 1, b: Infinity });
  });

  it('writes an infinity inside an object, a union, and a list of objects as a string', async () => {
    const cap = { kind: 'number', name: 'Cap', description: '', default: 0, endless: 'max' } as const;
    const limits = { kind: 'object', name: 'Limits', description: '', default: {}, children: { cap } } as const;
    const schema = {
      name: 'T',
      children: {
        limits,
        shape: {
          kind: 'union',
          name: 'Shape',
          description: '',
          default: { type: 'open' } as { type: string; cap?: number },
          tag: 'type',
          variants: {
            open: { kind: 'object', name: 'Open', description: '', default: {}, children: {} },
            capped: { kind: 'object', name: 'Capped', description: '', default: { cap: 1 }, children: { cap } },
          },
        },
        rows: { kind: 'list', name: 'Rows', description: '', default: [], item: limits },
      },
    } satisfies PrefGroup;
    const backing = new Map<string, unknown>();
    const cache = createRecordCache({ storage: createMemoryAdapter(backing), prefix: 'p.' });
    const store = createPrefsStore(schema, cache);
    store.set('limits', { cap: Infinity, other: 1 });
    store.set('shape', { type: 'capped', cap: Infinity });
    store.set('rows', [{ cap: Infinity }]);
    await cache.flush();
    expect(recordValue(backing.get('p.limits'))).toEqual({ cap: 'Infinity', other: 1 });
    expect(recordValue(backing.get('p.shape'))).toEqual({ type: 'capped', cap: 'Infinity' });
    expect(recordValue(backing.get('p.rows'))).toEqual([{ cap: 'Infinity' }]);
    expect(store.get('limits')).toEqual({ cap: Infinity, other: 1 });
    expect(store.get('shape')).toEqual({ type: 'capped', cap: Infinity });
    expect(store.get('rows')).toEqual([{ cap: Infinity }]);
  });

  it('unsets a leaf set to undefined, and stores nothing for it', async () => {
    const schema = {
      name: 'T',
      children: {
        script: {
          kind: 'enum',
          name: 'Script',
          description: '',
          default: undefined as string | undefined,
          clearable: true,
          options: [{ value: 'latin', label: 'Latin' }],
        },
      },
    } satisfies PrefGroup;
    localStorage.clear();
    const cache = createRecordCache({ storage: localStorageAdapter, prefix: 'u.' });
    const store = createPrefsStore(schema, cache);
    store.set('script', 'latin');
    store.set('script', undefined);
    expect(store.isSet('script')).toBe(false);
    expect(store.unset().has('script')).toBe(true);
    await cache.flush();
    expect(localStorage.getItem('u.script')).toBeNull();
    await store.close();
  });

  it('builds its trees from keys every object inherits without touching the originals', () => {
    const probe = { kind: 'string', name: 'Probe', description: '', default: 'x' } as const;
    const schema = {
      name: 'T',
      children: { constructor: { name: 'C', children: { probe, name: probe } } },
    } satisfies PrefGroup;
    const cache = createRecordCache({
      storage: createMemoryAdapter(),
      prefix: 'p.',
      initial: [['__proto__.polluted', 1]],
    });
    const store = createPrefsStore(schema, cache);
    expect(store.values()).toEqual({ constructor: { probe: 'x', name: 'x' } });
    expect((Object as unknown as Record<string, unknown>).probe).toBeUndefined();
    const stored = store.stored();
    expect(Object.getPrototypeOf(stored)).toBe(Object.prototype);
    expect(Object.hasOwn(stored, '__proto__')).toBe(true);
  });
});
