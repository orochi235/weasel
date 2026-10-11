import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { recordValue } from './stamp';
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
    expect(recordValue(cache.get('view.grid.visible'))).toBe(false);
    expect(recordValue(cache.get('view.density'))).toBe(20);
    expect(cache.get(VERSION_RECORD)).toBe(2);
  });

  it('skips migrations already applied', () => {
    const cache = cacheWith([[VERSION_RECORD, 1], ['view.density', 10]]);
    runPrefsMigrations(cache, [renameGrid, doubleDensity]);
    expect(recordValue(cache.get('view.density'))).toBe(20);
  });

  it('does nothing at the current version', () => {
    const cache = cacheWith([[VERSION_RECORD, 2], ['view.density', 10]]);
    runPrefsMigrations(cache, [renameGrid, doubleDensity]);
    expect(recordValue(cache.get('view.density'))).toBe(10);
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
    expect(recordValue(cache.get('view.density'))).toBe(10);
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
    expect(recordValue(cache.get('view.gridOn'))).toBe(false);
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
    expect(recordValue(cache.get('view.density'))).toBe(10);
  });

  it.each([['"1"', '1'], ['1.5', 1.5], ['-1', -1], ['an object', { v: 1 }]])(
    'opens read-only on an unreadable $version (%s), without re-running migrations',
    (_label, bad) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const cache = cacheWith([[VERSION_RECORD, bad], ['view.density', 20]]);
      runPrefsMigrations(cache, [doubleDensity]);
      expect(recordValue(cache.get('view.density'))).toBe(20);
      expect(cache.writable).toBe(false);
      expect(warn.mock.calls[0]![0]).toContain('unreadable $version');
      warn.mockRestore();
    },
  );

  it('deletes a record a migration sets to undefined', () => {
    const cache = cacheWith([['view.old', 1], ['view.density', 10]]);
    runPrefsMigrations(cache, [(records) => records.set('view.old', undefined)]);
    expect(cache.has('view.old')).toBe(false);
    expect(recordValue(cache.get('view.density'))).toBe(10);
  });
});

describe('record stamps', () => {
  it('stamps what an open migrates and what it finds unstamped, with the version reached', () => {
    const cache = cacheWith([[VERSION_RECORD, 1], ['view.density', 10], ['view.name', 'a']]);
    expect(runPrefsMigrations(cache, [renameGrid, doubleDensity])).toBe(true);
    expect(cache.get('view.density')).toEqual({ $at: 2, value: 20 });
    expect(cache.get('view.name')).toEqual({ $at: 2, value: 'a' });
  });

  it('migrates each record from its own stamp, and shows a migration only the records at its version', () => {
    const seen: string[][] = [];
    const spy = (inner: PrefsMigration): PrefsMigration => (records) => { seen.push([...records.keys()]); inner(records); };
    const cache = cacheWith([
      [VERSION_RECORD, 1],
      ['view.gridOn', { $at: 0, value: true }],
      ['view.density', { $at: 1, value: 10 }],
      ['view.zoom', { $at: 2, value: 3 }],
    ]);
    runPrefsMigrations(cache, [spy(renameGrid), spy(doubleDensity)]);
    expect(seen).toEqual([['view.gridOn'], ['view.density', 'view.grid.visible']]);
    expect(cache.get('view.grid.visible')).toEqual({ $at: 2, value: true });
    expect(cache.get('view.density')).toEqual({ $at: 2, value: 20 });
    expect(cache.get('view.zoom')).toEqual({ $at: 2, value: 3 });
  });

  it('writes nothing where every record is stamped current', () => {
    const cache = cacheWith([[VERSION_RECORD, 2], ['view.density', { $at: 2, value: 10 }]]);
    expect(runPrefsMigrations(cache, [renameGrid, doubleDensity])).toBe(false);
  });

  it('reads a value that only looks like a stamp as the value it is', () => {
    const cache = cacheWith([[VERSION_RECORD, 1], ['view.box', { $at: 1, value: 2, extra: true }]]);
    runPrefsMigrations(cache, [renameGrid]);
    expect(cache.get('view.box')).toEqual({ $at: 1, value: { $at: 1, value: 2, extra: true } });
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
    await vi.waitFor(() => expect(recordValue(cache.get('view.density'))).toBe(14));
    expect(cache.get(VERSION_RECORD)).toBe(2);
    expect(await cache.flush()).toBe(true);
    expect(recordValue(backing.get('p.view.density'))).toBe(14);
    expect(recordValue(backing.get('p.$version'))).toBe(2);
  });

  it('leaves a record this version wrote alone when a lower version record arrives later', async () => {
    const backing = new Map<string, unknown>();
    const cache = migrated(backing);
    const other = createMemoryAdapter(backing);
    // A peer tab on this build, then an older tab's late version write.
    await other.set('p.view.density', { $at: 2, value: 40 });
    await other.set('p.$version', 1);
    await vi.waitFor(() => expect(cache.get(VERSION_RECORD)).toBe(2));
    await new Promise((r) => setTimeout(r, 10));
    expect(cache.get('view.density')).toEqual({ $at: 2, value: 40 });
  });

  it('migrates a record stamped with an older version as it arrives, whatever the version record says', async () => {
    const backing = new Map<string, unknown>();
    const cache = migrated(backing);
    await createMemoryAdapter(backing).set('p.view.density', { $at: 1, value: 7 });
    await vi.waitFor(() => expect(cache.get('view.density')).toEqual({ $at: 2, value: 14 }));
    expect(cache.get(VERSION_RECORD)).toBe(2);
  });

  it('stops writing when another writer leaves a record stamped past this build', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const backing = new Map<string, unknown>();
    const cache = migrated(backing);
    await createMemoryAdapter(backing).set('p.view.density', { $at: 3, value: 7 });
    await vi.waitFor(() => expect(cache.writable).toBe(false));
    warn.mockRestore();
  });

  it('writes its version back, and migrates nothing, when another writer clears the store', async () => {
    const backing = new Map<string, unknown>();
    const cache = migrated(backing);
    const other = createMemoryAdapter(backing);
    await other.delete('p.$version');
    await other.set('p.view.gridOn', true);
    await new Promise((r) => setTimeout(r, 10));
    expect(recordValue(cache.get('view.density'))).toBe(20);
    expect(recordValue(cache.get('view.gridOn'))).toBe(true);
    expect(await cache.flush()).toBe(true);
    expect(recordValue(backing.get('p.$version'))).toBe(2);
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
