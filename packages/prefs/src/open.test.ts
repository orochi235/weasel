import { createMemoryAdapter, urlHashAdapter } from '@weasel-js/storage';
import { describe, expect, expectTypeOf, it } from 'vitest';
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

describe('openPrefsSync', () => {
  it('returns a ready store from an adapter that lists synchronously', () => {
    const backing = new Map<string, unknown>([['p.density', 20]]);
    const store = openPrefsSync(SCHEMA, { storage: createMemoryAdapter(backing), prefix: 'p.' });
    expect(store.get('density')).toBe(20);
  });

  it('refuses, at compile time, an adapter that cannot', () => {
    type Options = Parameters<typeof openPrefsSync<typeof SCHEMA>>[1];
    expectTypeOf<{ storage: typeof urlHashAdapter; prefix: string }>().not.toMatchTypeOf<Options>();
    expectTypeOf<{ storage: ReturnType<typeof createMemoryAdapter>; prefix: string }>().toMatchTypeOf<Options>();
  });
});
