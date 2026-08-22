import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from './adapters';
import {
  CURRENT_DOCUMENT_VERSION,
  deleteLegacyKeys,
  emptyDocument,
  labDocumentKey,
  MIGRATIONS,
  migrateV0toV1,
  migrateV1toV2,
  normalizeDocument,
  quarantineDocument,
  quarantineKey,
  readLegacyDocument,
  runMigrations,
} from './document';
import { labStorageKey } from './helpers';

describe('document keys', () => {
  it('namespaces the document key by storageKey', () => {
    expect(labDocumentKey('mylab')).toBe('lk:mylab:doc');
  });

  it('namespaces the quarantine key by storageKey', () => {
    expect(quarantineKey('mylab')).toBe('lk:mylab:quarantine');
  });

  it('cannot collide with a legacy bucket key of another lab', () => {
    for (const bucket of ['workspaces', 'saves', 'layout', 'theme'] as const) {
      expect(labDocumentKey(`a:${bucket}`)).not.toBe(labStorageKey('a', bucket));
      expect(labDocumentKey('a')).not.toBe(labStorageKey('a', bucket));
    }
  });

  it('cannot collide with a quarantine key of another lab', () => {
    expect(labDocumentKey('a:quarantine')).not.toBe(quarantineKey('a'));
  });
});

describe('emptyDocument', () => {
  it('is stamped at the current version with the given mode', () => {
    const doc = emptyDocument('light');
    expect(doc.version).toBe(CURRENT_DOCUMENT_VERSION);
    expect(doc.mode).toBe('light');
    expect(doc.trials).toEqual([]);
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
    expect(readLegacyDocument(createMemoryAdapter(), 'lab', 'auto')).toBeNull();
  });

  it('assembles a version-0 document from the four buckets', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'workspaces'), JSON.stringify([{ id: 'w1' }]));
    storage.write(labStorageKey('lab', 'saves'), JSON.stringify([{ id: 's1' }]));
    storage.write(labStorageKey('lab', 'layout'), JSON.stringify({ w1: { h: 4 } }));
    storage.write(labStorageKey('lab', 'theme'), 'dark');

    expect(readLegacyDocument(storage, 'lab', 'auto')).toEqual({
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

    const doc = readLegacyDocument(storage, 'lab', 'auto');
    expect(doc?.workspaces).toEqual([]);
    expect(doc?.saves).toEqual([{ id: 's1' }]);
  });

  it('falls back to fallbackMode when the theme key is absent', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'workspaces'), JSON.stringify([]));

    expect(readLegacyDocument(storage, 'lab', 'dark')?.mode).toBe('dark');
  });

  it('falls back to fallbackMode when the theme value is unrecognized', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'theme'), 'chartreuse');

    expect(readLegacyDocument(storage, 'lab', 'dark')?.mode).toBe('dark');
  });

  it('a valid theme value beats the fallback', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'theme'), 'light');

    expect(readLegacyDocument(storage, 'lab', 'dark')?.mode).toBe('light');
  });

  it('passes interstellar through untouched for migrateV0toV1 to coerce', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'theme'), 'interstellar');

    expect(readLegacyDocument(storage, 'lab', 'dark')?.mode).toBe('interstellar');
  });
});

describe('deleteLegacyKeys', () => {
  it('deletes all four legacy buckets when the document matches', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'workspaces'), JSON.stringify([{ id: 'w1' }]));
    storage.write(labStorageKey('lab', 'saves'), JSON.stringify([{ id: 's1' }]));
    storage.write(labStorageKey('lab', 'layout'), JSON.stringify({ w1: { h: 4 } }));
    storage.write(labStorageKey('lab', 'theme'), 'dark');
    storage.write(labDocumentKey('lab'), 'the-document');

    expect(deleteLegacyKeys(storage, 'lab', 'the-document')).toBe(true);

    expect(storage.read(labStorageKey('lab', 'workspaces'))).toBeNull();
    expect(storage.read(labStorageKey('lab', 'saves'))).toBeNull();
    expect(storage.read(labStorageKey('lab', 'layout'))).toBeNull();
    expect(storage.read(labStorageKey('lab', 'theme'))).toBeNull();
  });

  it('the document key itself survives deletion', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'workspaces'), JSON.stringify([{ id: 'w1' }]));
    storage.write(labDocumentKey('lab'), 'the-document');

    deleteLegacyKeys(storage, 'lab', 'the-document');

    expect(storage.read(labDocumentKey('lab'))).toBe('the-document');
  });

  it('deletes nothing and returns false when the document key is absent', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'workspaces'), JSON.stringify([{ id: 'w1' }]));

    expect(deleteLegacyKeys(storage, 'lab', 'the-document')).toBe(false);
    expect(storage.read(labStorageKey('lab', 'workspaces'))).not.toBeNull();
  });

  it('returns false when the adapter cannot delete, and the keys survive', () => {
    const mem = createMemoryAdapter();
    const storage = { read: mem.read, write: mem.write };
    storage.write(labStorageKey('lab', 'workspaces'), JSON.stringify([{ id: 'w1' }]));
    storage.write(labDocumentKey('lab'), 'the-document');

    expect(deleteLegacyKeys(storage, 'lab', 'the-document')).toBe(false);
    expect(storage.read(labStorageKey('lab', 'workspaces'))).not.toBeNull();
  });

  it('deletes nothing and returns false when the document key holds different content', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'workspaces'), JSON.stringify([{ id: 'w1' }]));
    storage.write(labDocumentKey('lab'), 'something-else');

    expect(deleteLegacyKeys(storage, 'lab', 'the-document')).toBe(false);
    expect(storage.read(labStorageKey('lab', 'workspaces'))).not.toBeNull();
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

  it.each(['light', 'dark', 'auto'] as const)('passes mode %s through unchanged', (mode) => {
    expect(migrateV0toV1({ version: 0, mode }).mode).toBe(mode);
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

  it('preserves a populated workspaces array', () => {
    const workspaces = [{ id: 'w1', instrumentName: 'osc' }];
    expect(migrateV0toV1({ version: 0, workspaces }).workspaces).toEqual(workspaces);
  });

  it('preserves a populated saves array', () => {
    const saves = [{ id: 's1', name: 'my save' }];
    expect(migrateV0toV1({ version: 0, saves }).saves).toEqual(saves);
  });

  it('preserves a populated layout object', () => {
    const layout = { w1: { h: 4 } };
    expect(migrateV0toV1({ version: 0, layout }).layout).toEqual(layout);
  });

  it('falls back layout to {} and workspaces/saves to [] without swapping them', () => {
    const out = migrateV0toV1({ version: 0, workspaces: 'nope', saves: 'nope', layout: 'nope' });
    expect(out.workspaces).toEqual([]);
    expect(out.saves).toEqual([]);
    expect(out.layout).toEqual({});
  });
});

describe('migrateV1toV2', () => {
  it('stamps version 2', () => {
    expect(migrateV1toV2({ version: 1, workspaces: [] }).version).toBe(2);
  });

  it('renames workspaces to trials, record for record', () => {
    const records = [{ id: 'w1', instrumentName: 'osc', state: { n: 1 } }];
    const out = migrateV1toV2({ version: 1, workspaces: records });
    expect(out.trials).toEqual(records);
    expect(out).not.toHaveProperty('workspaces');
  });

  it('leaves the other sections alone', () => {
    const out = migrateV1toV2({
      version: 1,
      workspaces: [],
      saves: [{ id: 's1' }],
      layout: { w1: { h: 4 } },
      mode: 'dark',
    });
    expect(out.saves).toEqual([{ id: 's1' }]);
    expect(out.layout).toEqual({ w1: { h: 4 } });
    expect(out.mode).toBe('dark');
  });

  it('falls back to an empty trials list when workspaces is the wrong shape', () => {
    expect(migrateV1toV2({ version: 1, workspaces: 'nope' }).trials).toEqual([]);
  });
});

describe('MIGRATIONS', () => {
  it('has one entry per version below the current one', () => {
    expect(MIGRATIONS).toHaveLength(CURRENT_DOCUMENT_VERSION);
  });

  it('indexes migrateV0toV1 at position 0', () => {
    expect(MIGRATIONS[0]).toBe(migrateV0toV1);
  });

  it('indexes migrateV1toV2 at position 1', () => {
    expect(MIGRATIONS[1]).toBe(migrateV1toV2);
  });

  it('walks a version-0 document all the way to trials', () => {
    const outcome = runMigrations(
      { version: 0, workspaces: [{ id: 'w1' }] },
      MIGRATIONS,
      CURRENT_DOCUMENT_VERSION,
    );
    expect(outcome).toMatchObject({ ok: true, migrated: true });
    expect(outcome.ok && outcome.doc.trials).toEqual([{ id: 'w1' }]);
  });
});

describe('quarantineDocument', () => {
  it('copies the document aside and confirms it landed', () => {
    const storage = createMemoryAdapter();

    expect(quarantineDocument(storage, 'lab', 'the-bytes')).toBe(true);
    expect(storage.read(quarantineKey('lab'))).toBe('the-bytes');
  });

  it('returns false when the quarantine write silently fails', () => {
    const storage = createMemoryAdapter();
    storage.write = () => {};

    expect(quarantineDocument(storage, 'lab', 'the-bytes')).toBe(false);
  });
});

describe('normalizeDocument', () => {
  it('fills in every missing section', () => {
    expect(normalizeDocument({ version: CURRENT_DOCUMENT_VERSION }, 'auto')).toEqual({
      version: CURRENT_DOCUMENT_VERSION,
      trials: [],
      saves: [],
      layout: {},
      mode: 'auto',
    });
  });

  it('uses the fallback mode when the document has none', () => {
    expect(normalizeDocument({ version: CURRENT_DOCUMENT_VERSION }, 'light').mode).toBe('light');
  });

  it('uses the fallback mode when the stored mode is unrecognized', () => {
    expect(
      normalizeDocument({ version: CURRENT_DOCUMENT_VERSION, mode: 'chartreuse' }, 'light').mode,
    ).toBe('light');
  });

  it('keeps a stored mode over the fallback', () => {
    expect(
      normalizeDocument({ version: CURRENT_DOCUMENT_VERSION, mode: 'dark' }, 'light').mode,
    ).toBe('dark');
  });

  it('preserves populated sections', () => {
    const trials = [{ id: 'w1' }];
    const saves = [{ id: 's1' }];
    const layout = { w1: { h: 4 } };
    const out = normalizeDocument(
      { version: CURRENT_DOCUMENT_VERSION, trials, saves, layout },
      'auto',
    );
    expect(out.trials).toEqual(trials);
    expect(out.saves).toEqual(saves);
    expect(out.layout).toEqual(layout);
  });

  it('replaces wrong-shaped sections without swapping them', () => {
    const out = normalizeDocument(
      { version: CURRENT_DOCUMENT_VERSION, trials: 'nope', saves: 'nope', layout: 'nope' },
      'auto',
    );
    expect(out.trials).toEqual([]);
    expect(out.saves).toEqual([]);
    expect(out.layout).toEqual({});
  });
});
