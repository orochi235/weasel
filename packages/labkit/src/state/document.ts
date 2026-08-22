import { labStorageKey } from './helpers';
import type { LabDocument, LabMode, Migration, StorageAdapter } from './types';

/** Bumped whenever the persisted shape changes; every bump needs a migration. */
export const CURRENT_DOCUMENT_VERSION = 1;

/** The one key a lab persists under. */
export function labDocumentKey(storageKey: string): string {
  return `lk:${storageKey}`;
}

/** Where a document that failed to migrate is set aside, so a bad migration
 *  loses state loudly rather than silently. */
export function quarantineKey(storageKey: string): string {
  return `lk:${storageKey}:quarantine`;
}

/** A fresh document at the current version. */
export function emptyDocument(mode: LabMode): LabDocument {
  return {
    version: CURRENT_DOCUMENT_VERSION,
    workspaces: [],
    saves: [],
    layout: {},
    mode,
  };
}

/** What a migration run produced: the migrated document, or why it refused. */
export type MigrationOutcome =
  | { ok: true; doc: Record<string, unknown>; migrated: boolean }
  | { ok: false; reason: 'future' | 'failed'; error?: unknown };

/** Walk a document forward to `target`, one migration at a time. A version
 *  above `target` is refused rather than parsed under a shape it may not
 *  have. */
export function runMigrations(
  raw: Record<string, unknown>,
  migrations: Migration[],
  target: number,
): MigrationOutcome {
  const from = typeof raw.version === 'number' ? raw.version : 0;
  if (from > target) return { ok: false, reason: 'future' };
  if (from === target) return { ok: true, doc: raw, migrated: false };

  let doc = raw;
  try {
    for (let v = from; v < target; v++) {
      const migration = migrations[v];
      if (!migration) throw new Error(`[labkit] no migration from version ${v}`);
      doc = migration(doc);
    }
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
  return { ok: true, doc, migrated: true };
}

const LEGACY_BUCKETS = ['workspaces', 'saves', 'layout', 'theme'] as const;

function parseOr<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn('[labkit] unparseable legacy bucket, dropping it');
    return fallback;
  }
}

/** Assemble a version-0 document out of the four pre-document keys, or null
 *  if none of them is present. */
export function readLegacyDocument(
  storage: StorageAdapter,
  storageKey: string,
): Record<string, unknown> | null {
  const present = LEGACY_BUCKETS.some((b) => storage.read(labStorageKey(storageKey, b)) !== null);
  if (!present) return null;

  return {
    version: 0,
    workspaces: parseOr(storage.read(labStorageKey(storageKey, 'workspaces')), []),
    saves: parseOr(storage.read(labStorageKey(storageKey, 'saves')), []),
    layout: parseOr(storage.read(labStorageKey(storageKey, 'layout')), {}),
    // `theme` held a bare string, never JSON.
    mode: storage.read(labStorageKey(storageKey, 'theme')) ?? 'auto',
  };
}

/** Delete the four pre-document keys. Called once the migrated document has
 *  been written, never before. */
export function deleteLegacyKeys(storage: StorageAdapter, storageKey: string): void {
  for (const bucket of LEGACY_BUCKETS) {
    storage.delete?.(labStorageKey(storageKey, bucket));
  }
}

/** Version 0 (four loose keys) to version 1 (one document). Normalizes the
 *  mode, including `interstellar` — the dark mode's name back when it was a
 *  theme. */
export function migrateV0toV1(doc: Record<string, unknown>): Record<string, unknown> {
  const raw = doc.mode === 'interstellar' ? 'dark' : doc.mode;
  const mode = raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'auto';
  return {
    version: 1,
    workspaces: Array.isArray(doc.workspaces) ? doc.workspaces : [],
    saves: Array.isArray(doc.saves) ? doc.saves : [],
    layout: doc.layout && typeof doc.layout === 'object' ? doc.layout : {},
    mode,
  };
}

/** Index `i` migrates a version-`i` document to version `i + 1`. */
export const MIGRATIONS: Migration[] = [migrateV0toV1];
