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
export const CURRENT_DOCUMENT_VERSION = 4;

/** Where a version-3 lab kept its one document. Read once, to fold it into
 *  records, then deleted. */
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

/** The four keys a lab used before it was one document. */
export function legacyKeys(storageKey: string): string[] {
  return LEGACY_BUCKETS.map((bucket) => labStorageKey(storageKey, bucket));
}

/** A value some substrate returned for an old key: already parsed, or a JSON
 *  string from a store that does not parse. `undefined` when it is neither. */
export function parseStored(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function bucketOr<T>(value: unknown, fallback: T, bucket: string, shape: 'array' | 'object'): T {
  if (value === undefined) return fallback;
  const parsed = parseStored(value);
  const fits = shape === 'array' ? Array.isArray(parsed) : !!parsed && typeof parsed === 'object';
  if (fits) return parsed as T;
  console.warn(`[labkit] unparseable legacy bucket "${bucket}", dropping it`);
  return fallback;
}

/** Assemble a version-0 document out of the four pre-document keys, or null
 *  if none of them is present. `fallbackMode` is used when the theme key is
 *  absent or holds something unrecognized; `interstellar` passes through
 *  untouched for `migrateV0toV1` to coerce. */
export async function readLegacyDocument(
  read: (key: string) => Promise<unknown>,
  storageKey: string,
  fallbackMode: LabMode,
): Promise<Record<string, unknown> | null> {
  const [workspaces, saves, layout, theme] = await Promise.all(
    LEGACY_BUCKETS.map((bucket) => read(labStorageKey(storageKey, bucket))),
  );
  if ([workspaces, saves, layout, theme].every((v) => v === undefined)) return null;

  const mode =
    theme === 'light' || theme === 'dark' || theme === 'auto' || theme === 'interstellar'
      ? theme
      : fallbackMode;

  return {
    version: 0,
    workspaces: bucketOr(workspaces, [], 'workspaces', 'array'),
    saves: bucketOr(saves, [], 'saves', 'array'),
    layout: bucketOr(layout, {}, 'layout', 'object'),
    mode,
  };
}

/** Whether two stored values hold the same data. Stored values are
 *  structured-clone copies, so identity says nothing. */
export function sameStored(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Delete `keys` and read each back, so an adapter whose delete silently did
 *  nothing is caught. `true` only once all of them are gone. */
export async function deleteConfirmed(storage: StorageAdapter, keys: string[]): Promise<boolean> {
  try {
    await Promise.all(keys.map((key) => storage.delete(key)));
    const left = await Promise.all(keys.map((key) => storage.get(key)));
    return left.every((v) => v === undefined);
  } catch {
    return false;
  }
}

/** Set `value` aside under the quarantine key, reading it back to confirm it
 *  landed. Returns `false` when it did not — a full disk is exactly when a
 *  document goes unreadable — so the caller can leave the original alone
 *  rather than overwrite the only copy of it. */
export async function quarantineDocument(
  storage: StorageAdapter,
  storageKey: string,
  value: unknown,
): Promise<boolean> {
  try {
    await storage.set(quarantineKey(storageKey), value);
    return sameStored(await storage.get(quarantineKey(storageKey)), value);
  } catch {
    return false;
  }
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

/** Version 3 to version 4: a lab is stored as records under one prefix
 *  instead of one document. The joined shape does not change. */
export function migrateV3toV4(doc: Record<string, unknown>): Record<string, unknown> {
  return { ...doc, version: 4 };
}

/** Index `i` migrates a version-`i` document to version `i + 1`. */
export const MIGRATIONS: Migration[] = [migrateV0toV1, migrateV1toV2, migrateV2toV3, migrateV3toV4];
