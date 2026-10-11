import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import { type PrefsMigration, runPrefsMigrations, watchPrefsVersion } from './migrate';
import { VERSION_RECORD } from './helpers';

const cacheWith = (initial: [string, unknown][]) =>
  createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial });

const renameGrid: PrefsMigration = (records) => {
  if (records.has('view.gridOn')) {
    records.set('view.grid.visible', records.get('view.gridOn'));
    records.delete('view.gridOn');
  }
};
const doubleDensity: PrefsMigration = (records) => {
  const d = records.get('view.density');
  if (typeof d === 'number') records.set('view.density', d * 2);
};

describe('runPrefsMigrations', () => {
  it('runs every migration from the stored version up, in order, and records the new version', () => {
    const cache = cacheWith([['view.gridOn', false], ['view.density', 10]]);
    runPrefsMigrations(cache, [renameGrid, doubleDensity]);
    expect(cache.has('view.gridOn')).toBe(false);
    expect(cache.get('view.grid.visible')).toBe(false);
    expect(cache.get('view.density')).toBe(20);
    expect(cache.get(VERSION_RECORD)).toBe(2);
  });

  it('skips migrations already applied', () => {
    const cache = cacheWith([[VERSION_RECORD, 1], ['view.density', 10]]);
    runPrefsMigrations(cache, [renameGrid, doubleDensity]);
    expect(cache.get('view.density')).toBe(20);
  });

  it('does nothing at the current version', () => {
    const cache = cacheWith([[VERSION_RECORD, 2], ['view.density', 10]]);
    runPrefsMigrations(cache, [renameGrid, doubleDensity]);
    expect(cache.get('view.density')).toBe(10);
  });

  it('records the version on an empty store, so later migrations do not run on fresh data', () => {
    const cache = cacheWith([]);
    runPrefsMigrations(cache, [renameGrid]);
    expect(cache.get(VERSION_RECORD)).toBe(1);
  });

  it('opens read-only on a version newer than it knows', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = cacheWith([[VERSION_RECORD, 5], ['view.density', 10]]);
    runPrefsMigrations(cache, [renameGrid]);
    expect(cache.writable).toBe(false);
    expect(cache.get('view.density')).toBe(10);
    expect(warn.mock.calls[0]![0]).toContain('5');
    warn.mockRestore();
  });

  it('writes nothing and opens read-only when a migration throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = cacheWith([['view.gridOn', false]]);
    const boom: PrefsMigration = () => {
      throw new Error('boom');
    };
    runPrefsMigrations(cache, [renameGrid, boom]);
    expect(cache.writable).toBe(false);
    expect(cache.get('view.gridOn')).toBe(false);
    expect(cache.has('view.grid.visible')).toBe(false);
    expect(cache.has(VERSION_RECORD)).toBe(false);
    warn.mockRestore();
  });

  it('leaves a read-only cache alone', () => {
    const cache = createRecordCache({
      storage: createMemoryAdapter(),
      prefix: 'p.',
      initial: [['view.density', 10]],
      writable: false,
    });
    runPrefsMigrations(cache, [doubleDensity]);
    expect(cache.get('view.density')).toBe(10);
  });

  it.each([['"1"', '1'], ['1.5', 1.5], ['-1', -1], ['an object', { v: 1 }]])(
    'opens read-only on an unreadable $version (%s), without re-running migrations',
    (_label, bad) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const cache = cacheWith([[VERSION_RECORD, bad], ['view.density', 20]]);
      runPrefsMigrations(cache, [doubleDensity]);
      expect(cache.get('view.density')).toBe(20);
      expect(cache.writable).toBe(false);
      expect(warn.mock.calls[0]![0]).toContain('unreadable $version');
      warn.mockRestore();
    },
  );

  it('deletes a record a migration sets to undefined', () => {
    const cache = cacheWith([['view.old', 1], ['view.density', 10]]);
    runPrefsMigrations(cache, [(records) => records.set('view.old', undefined)]);
    expect(cache.has('view.old')).toBe(false);
    expect(cache.get('view.density')).toBe(10);
  });
});

describe('watchPrefsVersion', () => {
  it('stops writing when another writer migrates past this build', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const backing = new Map<string, unknown>([['p.$version', 1]]);
    const cache = createRecordCache({
      storage: createMemoryAdapter(backing),
      prefix: 'p.',
      initial: [[VERSION_RECORD, 1]],
    });
    watchPrefsVersion(cache, [renameGrid]);
    await createMemoryAdapter(backing).set('p.$version', 2);
    await vi.waitFor(() => expect(cache.writable).toBe(false));
    expect(warn.mock.calls[0]![0]).toContain('migrated to version 2');
    warn.mockRestore();
  });

  const migrated = (backing: Map<string, unknown>) => {
    const cache = createRecordCache({
      storage: createMemoryAdapter(backing),
      prefix: 'p.',
      initial: [
        [VERSION_RECORD, 2],
        ['view.density', 20],
      ],
    });
    watchPrefsVersion(cache, [renameGrid, doubleDensity]);
    return cache;
  };

  it('migrates the records an older writer leaves, from the version it wrote', async () => {
    const backing = new Map<string, unknown>();
    const cache = migrated(backing);
    const older = createMemoryAdapter(backing);
    await older.set('p.view.density', 7);
    await older.set('p.$version', 1);
    await vi.waitFor(() => expect(cache.get('view.density')).toBe(14));
    expect(cache.get(VERSION_RECORD)).toBe(2);
    expect(await cache.flush()).toBe(true);
    expect(backing.get('p.view.density')).toBe(14);
    expect(backing.get('p.$version')).toBe(2);
  });

  it('writes its version back, and migrates nothing, when another writer clears the store', async () => {
    const backing = new Map<string, unknown>();
    const cache = migrated(backing);
    const other = createMemoryAdapter(backing);
    await other.delete('p.$version');
    await other.set('p.view.gridOn', true);
    await new Promise((r) => setTimeout(r, 10));
    expect(cache.get('view.density')).toBe(20);
    expect(cache.get('view.gridOn')).toBe(true);
    expect(await cache.flush()).toBe(true);
    expect(backing.get('p.$version')).toBe(2);
  });

  it('stops listening once unsubscribed', async () => {
    const backing = new Map<string, unknown>();
    const cache = createRecordCache({ storage: createMemoryAdapter(backing), prefix: 'p.' });
    watchPrefsVersion(cache, [renameGrid])();
    await createMemoryAdapter(backing).set('p.$version', 2);
    await new Promise((r) => setTimeout(r, 10));
    expect(cache.writable).toBe(true);
  });
});
