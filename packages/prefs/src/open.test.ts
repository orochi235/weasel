import { createMemoryAdapter, urlHashAdapter } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import { openPrefs, openPrefsSync } from './open';
import type { PrefGroup } from './schema';
import { VERSION_RECORD } from './helpers';

const SCHEMA = {
  name: 'Test',
  children: {
    density: { kind: 'number', name: 'Density', description: '', default: 72, min: 4, max: 288 },
  },
} satisfies PrefGroup;

describe('openPrefs', () => {
  it('loads stored values before resolving', async () => {
    const backing = new Map<string, unknown>([['p.density', 20]]);
    const store = await openPrefs(SCHEMA, { storage: createMemoryAdapter(backing), prefix: 'p.' });
    expect(store.get('density')).toBe(20);
  });

  it('runs migrations before the first read', async () => {
    const backing = new Map<string, unknown>([['p.density', 20]]);
    const store = await openPrefs(SCHEMA, {
      storage: createMemoryAdapter(backing),
      prefix: 'p.',
      migrations: [(r) => r.set('density', (r.get('density') as number) * 2)],
    });
    expect(store.get('density')).toBe(40);
    await store.flush();
    expect(backing.get(`p.${VERSION_RECORD}`)).toBe(1);
  });

  it('applies validators', async () => {
    const backing = new Map<string, unknown>([['p.density', 20]]);
    const store = await openPrefs(SCHEMA, {
      storage: createMemoryAdapter(backing),
      prefix: 'p.',
      validators: { number: () => 7 },
    });
    expect(store.get('density')).toBe(7);
  });
});

describe('migrated records', () => {
  const migrations = [(r: Map<string, unknown>) => r.set('density', 5)];

  it('openPrefs persists them before resolving', async () => {
    const backing = new Map<string, unknown>([['p.density', 20]]);
    await openPrefs(SCHEMA, { storage: createMemoryAdapter(backing), prefix: 'p.', migrations });
    expect(backing.get(`p.${VERSION_RECORD}`)).toBe(1);
    expect(backing.get('p.density')).toBe(5);
  });

  it('openPrefsSync starts persisting them at once', async () => {
    const backing = new Map<string, unknown>([['p.density', 20]]);
    openPrefsSync(SCHEMA, { storage: createMemoryAdapter(backing), prefix: 'p.', migrations });
    await Promise.resolve();
    expect(backing.get(`p.${VERSION_RECORD}`)).toBe(1);
  });
});

describe('openPrefsSync', () => {
  it('returns a ready store from an adapter that lists synchronously', () => {
    const backing = new Map<string, unknown>([['p.density', 20]]);
    const store = openPrefsSync(SCHEMA, { storage: createMemoryAdapter(backing), prefix: 'p.' });
    expect(store.get('density')).toBe(20);
  });

  it('refuses, at compile time, an adapter that cannot', () => {
    const never = () => {
      // @ts-expect-error urlHashAdapter cannot list synchronously
      openPrefsSync(SCHEMA, { storage: urlHashAdapter, prefix: 'p.' });
    };
    expect(never).toBeTypeOf('function');
  });

  it('stops persisting when a peer migrates the store past this build', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const backing = new Map<string, unknown>();
    const store = openPrefsSync(SCHEMA, {
      storage: createMemoryAdapter(backing),
      prefix: 'p.',
      migrations: [() => {}],
    });
    expect(store.writable).toBe(true);
    await store.flush();
    await createMemoryAdapter(backing).set('p.$version', 2);
    await vi.waitFor(() => expect(store.writable).toBe(false));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('migrated to version 2 by another writer'),
    );
    warn.mockRestore();
  });

  it('stops persisting when a peer writes a malformed $version', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const backing = new Map<string, unknown>();
    const store = openPrefsSync(SCHEMA, {
      storage: createMemoryAdapter(backing),
      prefix: 'p.',
      migrations: [() => {}],
    });
    await store.flush();
    await createMemoryAdapter(backing).set('p.$version', 'two');
    await vi.waitFor(() => expect(store.writable).toBe(false));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unreadable $version'));
    warn.mockRestore();
  });
});

describe('a peer migrating while the open is in flight', () => {
  it('is acted on, not just stored', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const backing = new Map<string, unknown>();
    const peer = createMemoryAdapter(backing);
    const inner = createMemoryAdapter(backing);
    const storage = {
      ...inner,
      set: async (key: string, value: unknown) => {
        if (key === 'p.$version') await peer.set(key, 2);
        await inner.set(key, value);
      },
    };
    const store = await openPrefs(SCHEMA, { storage, prefix: 'p.', migrations: [() => {}] });
    expect(store.writable).toBe(false);
    warn.mockRestore();
  });
});

describe('storage that is away at open', () => {
  /** An adapter over `backing` whose first list, of either kind, fails. */
  const awayAtFirst = (backing: Map<string, unknown>) => {
    const memory = createMemoryAdapter(backing);
    let away = true;
    const orFail = <T,>(read: () => T): T => {
      if (away) {
        away = false;
        throw new Error('server away');
      }
      return read();
    };
    return {
      ...memory,
      list: async (prefix: string) => orFail(() => memory.listSync(prefix)),
      listSync: (prefix: string) => orFail(() => memory.listSync(prefix)),
    };
  };

  it('shows the stored values and persists once a read lands', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const backing = new Map<string, unknown>([['p.density', 20]]);
    const store = await openPrefs(SCHEMA, { storage: awayAtFirst(backing), prefix: 'p.' });
    expect(store.writable).toBe(false);
    expect(store.get('density')).toBe(72);
    const heard: unknown[] = [];
    store.subscribe((changes) => heard.push(...changes));

    expect(await store.read()).toBe(true);
    expect(store.writable).toBe(true);
    expect(store.get('density')).toBe(20);
    expect(heard).toEqual([{ path: 'density', value: 20, origin: 'remote' }]);
    store.set('density', 30);
    expect(await store.flush()).toBe(true);
    expect(backing.get('p.density')).toBe(30);
    await store.close();
    warn.mockRestore();
  });

  it('keeps a value set meanwhile, and persists it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const backing = new Map<string, unknown>([['p.density', 20]]);
    const store = openPrefsSync(SCHEMA, { storage: awayAtFirst(backing), prefix: 'p.' });
    store.set('density', 30);
    await store.read();
    expect(store.get('density')).toBe(30);
    expect(await store.flush()).toBe(true);
    expect(backing.get('p.density')).toBe(30);
    await store.close();
    warn.mockRestore();
  });

  it('stays read-only when the records that land are from a newer build', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const backing = new Map<string, unknown>([
      ['p.$version', 2],
      ['p.density', 20],
    ]);
    const store = await openPrefs(SCHEMA, {
      storage: awayAtFirst(backing),
      prefix: 'p.',
      migrations: [() => {}],
    });
    store.set('density', 30);
    await store.read();
    expect(store.writable).toBe(false);
    await store.flush();
    expect(backing.get('p.density')).toBe(20);
    await store.close();
    warn.mockRestore();
  });
});
