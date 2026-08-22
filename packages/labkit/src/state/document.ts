import type { LabDocument, LabMode, Migration } from './types';

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
