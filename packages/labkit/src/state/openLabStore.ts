import {
  type OwnedRecordCache,
  openRecords,
  type RecordCache,
  type StorageAdapter,
} from '@weasel-js/storage';
import { type BindOptions, bindLabStore } from './bindLabStore';
import {
  CURRENT_DOCUMENT_VERSION,
  deleteConfirmed,
  emptyDocument,
  labDocumentKey,
  legacyKeys,
  MIGRATIONS,
  normalizeDocument,
  parseStored,
  quarantineDocument,
  readLegacyDocument,
  runMigrations,
  sameStored,
} from './document';
import { hydrateSnapshots, hydrateTrials } from './hydrate';
import {
  documentOfRecords,
  type LabMeta,
  labPrefix,
  META_RECORD,
  recordsOfDocument,
} from './labRecords';
import { createLabStore, type LabStore } from './store';
import type { CreateLabStoreOptions, LabDocument, LabMode, UnreadableRecord } from './types';

/** Options for `openLabStore`. `storageKey` names the lab, so two labs on one
 *  origin keep separate records. */
export interface OpenLabStoreOptions extends Omit<CreateLabStoreOptions, 'initial'> {
  storageKey: string;
  storage: StorageAdapter;
}

/** A lab store bound to its records. */
export interface OpenedLabStore {
  store: LabStore;
  /** Every record of the lab, `usePersistedState` values included. */
  records: RecordCache;
  /** Send queued writes and stop hearing other writers. */
  close(): Promise<void>;
}

/**
 * Read a stored lab and return a store bound to it: every change to the store
 * is written as the records it touched, and another writer's records are
 * applied back into the store. A lab stored before records existed is folded
 * forward on the way in.
 *
 * Where storage cannot be read at open, the store starts empty and unbound.
 * When a later read lands, the stored lab is migrated as it would have been at
 * open and merged into whatever was built meanwhile, which is then written.
 */
export async function openLabStore(options: OpenLabStoreOptions): Promise<OpenedLabStore> {
  const records = await openRecords({
    storage: options.storage,
    prefix: labPrefix(options.storageKey),
  });
  let unbind = (): void => {};
  let closed = false;
  let store: LabStore;
  if (records.writable) {
    const { doc, orders } = await readLab(options, records);
    store = createLabStore({ ...options, initial: doc });
    unbind = bindLabStore(store, records, { orders });
  } else {
    store = createLabStore({ ...options, initial: emptyDocument(options.initialMode ?? 'auto') });
    void records
      .whenRead()
      .then(async () => {
        if (closed) return;
        const late = await readLab(options, records);
        if (!closed) unbind = bindLabStore(store, records, mergeLate(store, late, records));
      })
      .catch((error: unknown) => {
        console.warn('[labkit] could not merge the lab read late; not persisting', error);
        records.stopWriting();
      });
  }
  return {
    store,
    records,
    close: async () => {
      closed = true;
      unbind();
      await records.close();
    },
  };
}

/**
 * Put a lab read late into the store, by id as another writer's records would
 * land: a stored trial or snapshot replaces one of the same id built while
 * storage was away, and the rest of what was built follows the stored ones.
 * Returns what to bind with, naming what the records do not hold yet.
 */
function mergeLate(store: LabStore, late: ReadLab, records: OwnedRecordCache): BindOptions {
  const { doc } = late;
  const away = store.getState();
  const hooks = away.instrumentHooks();
  const storedTrials = new Set(doc.trials.map((t) => t.id));
  const storedSaves = new Set(doc.saves.map((s) => s.id));
  const builtTrials = away.trials.filter((t) => !storedTrials.has(t.id));
  const builtSaves = away.savedSnapshots.filter((s) => !storedSaves.has(s.id));
  // With no meta record, `doc` is the empty lab and its mode is nobody's choice.
  const held = records.writable && records.has(META_RECORD);
  const unreadable: UnreadableRecord[] = [];
  const failed = (record: UnreadableRecord): void => void unreadable.push(record);
  store.setState({
    trials: [...hydrateTrials(doc.trials, hooks.serializers, hooks, failed), ...builtTrials],
    savedSnapshots: [...hydrateSnapshots(doc.saves, hooks, failed), ...builtSaves],
    unreadable,
    layout: { ...away.layout, ...doc.layout },
    undockedPanels: { ...away.undockedPanels, ...doc.undockedPanels },
    ...(held ? { mode: doc.mode } : {}),
  });
  return {
    orders: late.orders,
    unsaved: {
      trials: builtTrials.map((t) => t.id),
      saves: builtSaves.map((s) => s.id),
      layout: Object.keys(away.layout).length > 0,
      undock: Object.keys(away.undockedPanels).length > 0,
      mode: !held && away.mode !== doc.mode,
    },
  };
}

interface ReadLab {
  doc: LabDocument;
  orders: Map<string, number>;
}

function emptyLab(mode: LabMode): ReadLab {
  return { doc: emptyDocument(mode), orders: new Map() };
}

function ordersOf(doc: LabDocument): Map<string, number> {
  return new Map(doc.trials.map((t, i) => [t.id, i]));
}

async function readLab(options: OpenLabStoreOptions, records: OwnedRecordCache): Promise<ReadLab> {
  const mode = options.initialMode ?? 'auto';
  if (!records.writable) return emptyLab(mode);

  const joined = documentOfRecords(records.entries());
  if (!joined) return foldOldStorage(options, records);

  const outcome = runMigrations(joined.doc, MIGRATIONS, CURRENT_DOCUMENT_VERSION);
  if (outcome.ok) {
    return { doc: normalizeDocument(outcome.doc, mode), orders: joined.orders };
  }
  const why =
    outcome.reason === 'future' ? 'are from a newer version of labkit' : 'failed to migrate';
  console.warn(`[labkit] lab records ${why}; starting empty and leaving them alone`, outcome.error);
  records.stopWriting();
  return emptyLab(mode);
}

/** Fold a version-3 document, or the four keys before it, into records. The
 *  old keys are deleted only once every record has been read back. */
async function foldOldStorage(
  options: OpenLabStoreOptions,
  records: OwnedRecordCache,
): Promise<ReadLab> {
  const { storage, storageKey } = options;
  const mode = options.initialMode ?? 'auto';

  let raw: unknown;
  let oldKeys: string[];
  try {
    const stored = await storage.get(labDocumentKey(storageKey));
    if (stored !== undefined) {
      raw = stored;
      oldKeys = [labDocumentKey(storageKey)];
    } else {
      raw = await readLegacyDocument((key) => storage.get(key), storageKey, mode);
      oldKeys = legacyKeys(storageKey);
      if (raw === null) return emptyLab(mode);
    }
  } catch (error) {
    console.warn(
      `[labkit] could not read the old storage for "${storageKey}"; not persisting`,
      error,
    );
    records.stopWriting();
    return emptyLab(mode);
  }

  const setAside = async (value: unknown, why: string, error?: unknown): Promise<ReadLab> => {
    if (await quarantineDocument(storage, storageKey, value)) {
      console.warn(`[labkit] ${why}; quarantined it and starting empty`, error);
      await deleteConfirmed(storage, oldKeys);
      records.set(META_RECORD, { version: CURRENT_DOCUMENT_VERSION, mode } satisfies LabMeta);
    } else {
      console.warn(
        `[labkit] ${why} and could not be quarantined; leaving it in place and not persisting`,
        error,
      );
      records.stopWriting();
    }
    return emptyLab(mode);
  };

  const parsed = parseStored(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return setAside(raw, 'lab document is unparseable');
  }
  const outcome = runMigrations(
    parsed as Record<string, unknown>,
    MIGRATIONS,
    CURRENT_DOCUMENT_VERSION,
  );
  if (!outcome.ok) {
    if (outcome.reason === 'future') {
      console.warn(
        '[labkit] lab document is from a newer version of labkit; starting empty and leaving it alone',
      );
      records.stopWriting();
      return emptyLab(mode);
    }
    return setAside(parsed, 'lab document failed to migrate', outcome.error);
  }

  const doc = normalizeDocument(outcome.doc, mode);
  const entries = recordsOfDocument(doc);
  records.seed(entries);
  if (await writeConfirmed(storage, records.prefix, entries)) {
    // The old layout bucket and the layout record share a key when the storage
    // key needs no encoding.
    const written = new Set(entries.map(([name]) => records.prefix + name));
    await deleteConfirmed(
      storage,
      oldKeys.filter((key) => !written.has(key)),
    );
  } else {
    console.warn(
      `[labkit] keeping the old storage for "${storageKey}": could not confirm its records were written`,
    );
  }
  return { doc, orders: ordersOf(doc) };
}

/** Write `entries` in order and read every one back. */
async function writeConfirmed(
  storage: StorageAdapter,
  prefix: string,
  entries: [string, unknown][],
): Promise<boolean> {
  try {
    for (const [name, value] of entries) await storage.set(prefix + name, value);
    const back = new Map(await storage.list(prefix));
    return entries.every(([name, value]) => sameStored(back.get(prefix + name), value));
  } catch {
    return false;
  }
}
