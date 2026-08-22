import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from './adapters';
import {
  CURRENT_DOCUMENT_VERSION,
  deleteLegacyKeys,
  emptyDocument,
  labDocumentKey,
  MIGRATIONS,
  migrateV0toV1,
  quarantineKey,
  readLegacyDocument,
  runMigrations,
} from './document';
import { labStorageKey } from './helpers';

describe('document keys', () => {
  it('namespaces the document key by storageKey', () => {
    expect(labDocumentKey('mylab')).toBe('lk:mylab');
  });

  it('namespaces the quarantine key by storageKey', () => {
    expect(quarantineKey('mylab')).toBe('lk:mylab:quarantine');
  });
});

describe('emptyDocument', () => {
  it('is stamped at the current version with the given mode', () => {
    const doc = emptyDocument('light');
    expect(doc.version).toBe(CURRENT_DOCUMENT_VERSION);
    expect(doc.mode).toBe('light');
    expect(doc.workspaces).toEqual([]);
    expect(doc.saves).toEqual([]);
    expect(doc.layout).toEqual({});
  });
});

const bump = (to: number) => (doc: Record<string, unknown>) => ({ ...doc, version: to });

describe('runMigrations', () => {
  it('returns a current-version document untouched', () => {
    const doc = { version: 2, a: 1 };
    const out = runMigrations(doc, [bump(1), bump(2)], 2);
    expect(out).toEqual({ ok: true, doc: { version: 2, a: 1 }, migrated: false });
  });

  it('runs every migration from the stored version to the current one', () => {
    const out = runMigrations({ version: 0 }, [bump(1), bump(2)], 2);
    expect(out).toEqual({ ok: true, doc: { version: 2 }, migrated: true });
  });

  it('refuses a document from a future version', () => {
    const out = runMigrations({ version: 9 }, [bump(1)], 1);
    expect(out).toEqual({ ok: false, reason: 'future' });
  });

  it('reports a throwing migration as failed', () => {
    const boom = () => {
      throw new Error('nope');
    };
    const out = runMigrations({ version: 0 }, [boom], 1);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('failed');
  });

  it('treats a document with no version as version 0', () => {
    const out = runMigrations({}, [bump(1)], 1);
    expect(out).toEqual({ ok: true, doc: { version: 1 }, migrated: true });
  });
});

describe('readLegacyDocument', () => {
  it('returns null when no legacy key is present', () => {
    expect(readLegacyDocument(createMemoryAdapter(), 'lab')).toBeNull();
  });

  it('assembles a version-0 document from the four buckets', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'workspaces'), JSON.stringify([{ id: 'w1' }]));
    storage.write(labStorageKey('lab', 'saves'), JSON.stringify([{ id: 's1' }]));
    storage.write(labStorageKey('lab', 'layout'), JSON.stringify({ w1: { h: 4 } }));
    storage.write(labStorageKey('lab', 'theme'), 'dark');

    expect(readLegacyDocument(storage, 'lab')).toEqual({
      version: 0,
      workspaces: [{ id: 'w1' }],
      saves: [{ id: 's1' }],
      layout: { w1: { h: 4 } },
      mode: 'dark',
    });
  });

  it('survives one unparseable bucket without losing the others', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'workspaces'), '{{{not json');
    storage.write(labStorageKey('lab', 'saves'), JSON.stringify([{ id: 's1' }]));

    const doc = readLegacyDocument(storage, 'lab');
    expect(doc?.workspaces).toEqual([]);
    expect(doc?.saves).toEqual([{ id: 's1' }]);
  });
});

describe('deleteLegacyKeys', () => {
  it('deletes all four legacy buckets', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'workspaces'), JSON.stringify([{ id: 'w1' }]));
    storage.write(labStorageKey('lab', 'saves'), JSON.stringify([{ id: 's1' }]));
    storage.write(labStorageKey('lab', 'layout'), JSON.stringify({ w1: { h: 4 } }));
    storage.write(labStorageKey('lab', 'theme'), 'dark');

    deleteLegacyKeys(storage, 'lab');

    expect(storage.read(labStorageKey('lab', 'workspaces'))).toBeNull();
    expect(storage.read(labStorageKey('lab', 'saves'))).toBeNull();
    expect(storage.read(labStorageKey('lab', 'layout'))).toBeNull();
    expect(storage.read(labStorageKey('lab', 'theme'))).toBeNull();
  });
});

describe('migrateV0toV1', () => {
  it('stamps version 1', () => {
    expect(migrateV0toV1({ version: 0 }).version).toBe(1);
  });

  it('renames the old interstellar mode to dark', () => {
    expect(migrateV0toV1({ version: 0, mode: 'interstellar' }).mode).toBe('dark');
  });

  it('replaces an unrecognized mode with auto', () => {
    expect(migrateV0toV1({ version: 0, mode: 'chartreuse' }).mode).toBe('auto');
  });

  it('fills in every missing section', () => {
    expect(migrateV0toV1({ version: 0 })).toEqual({
      version: 1,
      workspaces: [],
      saves: [],
      layout: {},
      mode: 'auto',
    });
  });
});

describe('MIGRATIONS', () => {
  it('has one entry per version below the current one', () => {
    expect(MIGRATIONS).toHaveLength(CURRENT_DOCUMENT_VERSION);
  });
});
