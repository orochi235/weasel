import { labStorageKey } from './helpers';
import type {
  LabDocument,
  LabMode,
  Migration,
  SavedSnapshot,
  SerializedTrial,
  StorageAdapter,
} from './types';
import type { UndockedPanels } from './undock';

/** Bumped whenever the persisted shape changes; every bump needs a migration. */
export const CURRENT_DOCUMENT_VERSION = 3;

/** The one key a lab persists under. The `:doc` suffix keeps it out of the
 *  legacy bucket namespace, where a lab named `a:saves` would otherwise write
 *  its document over lab `a`'s saves bucket. */
export function labDocumentKey(storageKey: string): string {
  return `lk:${storageKey}:doc`;
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
    undockedPanels: {},
    trials: [],
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

function parseOr<T>(raw: string | null, fallback: T, bucket: string): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`[labkit] unparseable legacy bucket "${bucket}", dropping it`);
    return fallback;
  }
}

/** Assemble a version-0 document out of the four pre-document keys, or null
 *  if none of them is present. `fallbackMode` is used when the theme key is
 *  absent or holds something unrecognized; `interstellar` passes through
 *  untouched for `migrateV0toV1` to coerce. */
export function readLegacyDocument(
  storage: StorageAdapter,
  storageKey: string,
  fallbackMode: LabMode,
): Record<string, unknown> | null {
  const present = LEGACY_BUCKETS.some((b) => storage.read(labStorageKey(storageKey, b)) !== null);
  if (!present) return null;

  const rawMode = storage.read(labStorageKey(storageKey, 'theme'));
  const mode =
    rawMode === 'light' || rawMode === 'dark' || rawMode === 'auto' || rawMode === 'interstellar'
      ? rawMode
      : fallbackMode;

  return {
    version: 0,
    workspaces: parseOr(storage.read(labStorageKey(storageKey, 'workspaces')), [], 'workspaces'),
    saves: parseOr(storage.read(labStorageKey(storageKey, 'saves')), [], 'saves'),
    layout: parseOr(storage.read(labStorageKey(storageKey, 'layout')), {}, 'layout'),
    mode,
  };
}

/** Delete the four pre-document keys, but only once `expectedDocument` is
 *  confirmed to be exactly what is stored under the document key — a
 *  read-back, not a trust of the write that produced it. On any mismatch
 *  (write failed, landed partially, or never happened) it deletes nothing,
 *  warns, and returns `false` so the legacy buckets stay as a recoverable
 *  copy. Deletion itself is read back too — `StorageAdapter.delete` is
 *  optional, so an adapter without it leaves the keys in place — and `true`
 *  is returned only once all four are actually gone. */
export function deleteLegacyKeys(
  storage: StorageAdapter,
  storageKey: string,
  expectedDocument: string,
): boolean {
  const actual = storage.read(labDocumentKey(storageKey));
  if (actual !== expectedDocument) {
    console.warn(
      `[labkit] keeping legacy keys for "${storageKey}": could not confirm the migrated document was written`,
    );
    return false;
  }
  let allGone = true;
  for (const bucket of LEGACY_BUCKETS) {
    const key = labStorageKey(storageKey, bucket);
    storage.delete?.(key);
    if (storage.read(key) !== null) allGone = false;
  }
  return allGone;
}

/** Set `raw` aside under the quarantine key, reading it back to confirm it
 *  landed. Returns `false` when it did not — a full disk is exactly when a
 *  document goes unreadable — so the caller can leave the original alone
 *  rather than overwrite the only copy of it. */
export function quarantineDocument(
  storage: StorageAdapter,
  storageKey: string,
  raw: string,
): boolean {
  storage.write(quarantineKey(storageKey), raw);
  return storage.read(quarantineKey(storageKey)) === raw;
}

/** Fill in whatever a document is missing or holds the wrong shape of, so a
 *  hydrated store never sees `undefined` where a section should be. Applied to
 *  every document, migrated or already current. */
export function normalizeDocument(
  doc: Record<string, unknown>,
  fallbackMode: LabMode,
): LabDocument {
  const mode =
    doc.mode === 'light' || doc.mode === 'dark' || doc.mode === 'auto' ? doc.mode : fallbackMode;
  return {
    version: CURRENT_DOCUMENT_VERSION,
    trials: Array.isArray(doc.trials) ? (doc.trials as SerializedTrial[]) : [],
    saves: Array.isArray(doc.saves) ? (doc.saves as SavedSnapshot[]) : [],
    layout:
      doc.layout && typeof doc.layout === 'object' ? (doc.layout as Record<string, unknown>) : {},
    undockedPanels:
      doc.undockedPanels && typeof doc.undockedPanels === 'object'
        ? (doc.undockedPanels as UndockedPanels)
        : {},
    mode,
  };
}

/** Version 0 (four loose keys) to version 1 (one document). Normalizes the
 *  mode, including `interstellar` — the dark mode's name back when it was a
 *  theme. Coerces against version 1's own field names rather than reusing
 *  `normalizeDocument`, which produces the current shape and would drop
 *  `workspaces` from a document it labels version 1. */
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

/** Version 1 to version 2: the vocabulary refresh renamed a tile from
 *  workspace to trial. Only the records field moves; a record's own fields are
 *  unchanged. */
export function migrateV1toV2(doc: Record<string, unknown>): Record<string, unknown> {
  const { workspaces, ...rest } = doc;
  return { ...rest, trials: Array.isArray(workspaces) ? workspaces : [], version: 2 };
}

/** Version 2 to version 3: undocked sidebar panels became persisted state.
 *  Nothing existing moves; the field simply starts empty. */
export function migrateV2toV3(doc: Record<string, unknown>): Record<string, unknown> {
  return { ...doc, undockedPanels: {}, version: 3 };
}

/** Index `i` migrates a version-`i` document to version `i + 1`. */
export const MIGRATIONS: Migration[] = [migrateV0toV1, migrateV1toV2, migrateV2toV3];
