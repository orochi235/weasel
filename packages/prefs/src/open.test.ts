import { createMemoryAdapter, urlHashAdapter } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import { openPrefs, openPrefsSync } from './open';
import type { PrefGroup } from './schema';
import { VERSION_RECORD } from './store';

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
    warn.mockRestore();
  });
});
