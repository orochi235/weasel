import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import { type PrefsMigration, runPrefsMigrations } from './migrate';
import { VERSION_RECORD } from './store';

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
});
