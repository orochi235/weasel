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
import { serializeTrials } from './helpers';
import {
  compareTrialOrder,
  documentOfRecords,
  LAYOUT_RECORD,
  type LabMeta,
  labPrefix,
  META_RECORD,
  parseRecordName,
  recordsOfDocument,
  saveRecord,
  trialRecord,
  trialValuesPrefix,
  UNDOCK_RECORD,
} from './labRecords';
import { type OwnedRecordCache, openRecords, type RecordCache } from './records';
import { createLabStore, hydrateSnapshots, hydrateTrials, type LabStore } from './store';
import type {
  CreateLabStoreOptions,
  InstrumentSerializers,
  LabDocument,
  LabMode,
  SavedSnapshot,
  SerializedTrial,
  StorageAdapter,
  TrialRecord,
} from './types';

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
 */
export async function openLabStore(options: OpenLabStoreOptions): Promise<OpenedLabStore> {
  const records = await openRecords({
    storage: options.storage,
    prefix: labPrefix(options.storageKey),
  });
  const { doc, orders } = await readLab(options, records);
  const store = createLabStore({ ...options, initial: doc });
  const unbind = bindLabStore(store, records, {
    serializers: options.serializers ?? {},
    configDefaults: options.configDefaults ?? {},
    orders,
  });
  return {
    store,
    records,
    close: async () => {
      unbind();
      await records.close();
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
    await deleteConfirmed(storage, oldKeys);
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

interface BindOptions {
  serializers: InstrumentSerializers;
  configDefaults: Record<string, () => unknown>;
  orders: Map<string, number>;
}

function persistedFieldsDiffer(a: TrialRecord, b: TrialRecord): boolean {
  if (a === b) return false;
  const left = a as unknown as Record<string, unknown>;
  const right = b as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (key !== 'undoStack' && !Object.is(left[key], right[key])) return true;
  }
  return false;
}

/** Keep `store` and `records` in step, both ways. Returns the unbinding. */
function bindLabStore(store: LabStore, records: RecordCache, options: BindOptions): () => void {
  const { serializers, configDefaults } = options;
  const orderOf = new Map(options.orders);
  let applyingRemote = false;

  const nextOrder = (): number => {
    let max = -1;
    for (const order of orderOf.values()) max = Math.max(max, order);
    return max + 1;
  };

  const writeTrial = (trial: TrialRecord): void => {
    const [serialized] = serializeTrials([trial], serializers);
    records.set(trialRecord(trial.id), { ...serialized, order: orderOf.get(trial.id) });
  };

  const inStoredOrder = (trials: TrialRecord[]): boolean => {
    for (let i = 1; i < trials.length; i++) {
      const a = trials[i - 1] as TrialRecord;
      const b = trials[i] as TrialRecord;
      const at = { trial: a, order: orderOf.get(a.id) ?? 0 };
      const bt = { trial: b, order: orderOf.get(b.id) ?? 0 };
      if (compareTrialOrder(at, bt) >= 0) return false;
    }
    return true;
  };

  const offStore = store.subscribe((state, prev) => {
    if (applyingRemote) return;
    let wrote = false;

    if (state.trials !== prev.trials) {
      const before = new Map(prev.trials.map((t) => [t.id, t]));
      const now = new Set(state.trials.map((t) => t.id));
      for (const t of prev.trials) {
        if (now.has(t.id)) continue;
        records.delete(trialRecord(t.id));
        for (const [name] of records.entries(trialValuesPrefix(t.id))) records.delete(name);
        orderOf.delete(t.id);
        wrote = true;
      }
      const added = state.trials.filter((t) => !before.has(t.id));
      for (const t of added) orderOf.set(t.id, nextOrder());
      if (inStoredOrder(state.trials)) {
        for (const t of state.trials) {
          const old = before.get(t.id);
          if (old && !persistedFieldsDiffer(old, t)) continue;
          writeTrial(t);
          wrote = true;
        }
      } else {
        // A reorder, or a trial inserted mid-list: renumber them all.
        for (const [i, t] of state.trials.entries()) orderOf.set(t.id, i);
        for (const t of state.trials) writeTrial(t);
        wrote = true;
      }
    }

    if (state.savedSnapshots !== prev.savedSnapshots) {
      const before = new Map(prev.savedSnapshots.map((s) => [s.id, s]));
      const now = new Set(state.savedSnapshots.map((s) => s.id));
      for (const s of state.savedSnapshots) {
        if (before.get(s.id) === s) continue;
        records.set(saveRecord(s.id), s);
        wrote = true;
      }
      for (const s of prev.savedSnapshots) {
        if (now.has(s.id)) continue;
        records.delete(saveRecord(s.id));
        wrote = true;
      }
    }

    if (state.layout !== prev.layout) {
      records.set(LAYOUT_RECORD, state.layout);
      wrote = true;
    }
    if (state.undockedPanels !== prev.undockedPanels) {
      records.set(UNDOCK_RECORD, state.undockedPanels);
      wrote = true;
    }
    if (state.mode !== prev.mode || (wrote && !records.has(META_RECORD))) {
      records.set(META_RECORD, {
        version: CURRENT_DOCUMENT_VERSION,
        mode: state.mode,
      } satisfies LabMeta);
    }
  });

  const offRecords = records.subscribe((changes) => {
    const remote = changes.filter((c) => c.origin === 'remote');
    if (remote.length === 0) return;

    const current = store.getState();
    let trials = current.trials;
    let saves = current.savedSnapshots;
    const patch: Partial<Pick<typeof current, 'layout' | 'undockedPanels' | 'mode'>> = {};

    for (const { name, value } of remote) {
      const parsed = parseRecordName(name);
      if (!parsed) continue;
      switch (parsed.kind) {
        case 'trial': {
          const id = parsed.id;
          if (value === undefined || !value || typeof value !== 'object') {
            trials = trials.filter((t) => t.id !== id);
            orderOf.delete(id);
            break;
          }
          const { order, ...rest } = value as SerializedTrial & { order?: unknown };
          orderOf.set(
            id,
            typeof order === 'number' && Number.isFinite(order) ? order : nextOrder(),
          );
          // Hydrating starts an empty undo history: the old one describes a
          // state that no longer exists.
          const [replacement] = hydrateTrials([{ ...rest, id }], serializers, configDefaults);
          if (!replacement) break;
          trials = trials.some((t) => t.id === id)
            ? trials.map((t) => (t.id === id ? replacement : t))
            : [...trials, replacement];
          break;
        }
        case 'save': {
          const id = parsed.id;
          if (value === undefined || !value || typeof value !== 'object') {
            saves = saves.filter((s) => s.id !== id);
            break;
          }
          const [snapshot] = hydrateSnapshots(
            [{ ...(value as SavedSnapshot), id }],
            configDefaults,
          );
          if (!snapshot) break;
          saves = saves.some((s) => s.id === id)
            ? saves.map((s) => (s.id === id ? snapshot : s))
            : [...saves, snapshot];
          break;
        }
        case 'layout':
          patch.layout = (value as Record<string, unknown> | undefined) ?? {};
          break;
        case 'undock':
          patch.undockedPanels = (value as typeof current.undockedPanels | undefined) ?? {};
          break;
        case 'meta': {
          const meta = value as Partial<LabMeta> | undefined;
          if (typeof meta?.version === 'number' && meta.version > CURRENT_DOCUMENT_VERSION) {
            console.warn(
              '[labkit] another tab wrote this lab with a newer labkit; no longer persisting',
            );
            if ('stopWriting' in records) (records as OwnedRecordCache).stopWriting();
            break;
          }
          if (meta?.mode === 'light' || meta?.mode === 'dark' || meta?.mode === 'auto') {
            patch.mode = meta.mode;
          }
          break;
        }
      }
    }

    if (trials !== current.trials) {
      trials = [...trials].sort((a, b) =>
        compareTrialOrder(
          { trial: a, order: orderOf.get(a.id) ?? 0 },
          { trial: b, order: orderOf.get(b.id) ?? 0 },
        ),
      );
    }
    applyingRemote = true;
    try {
      store.setState({ ...patch, trials, savedSnapshots: saves });
    } finally {
      applyingRemote = false;
    }
  });

  return () => {
    offStore();
    offRecords();
  };
}
