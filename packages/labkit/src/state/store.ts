import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  CURRENT_DOCUMENT_VERSION,
  deleteLegacyKeys,
  emptyDocument,
  labDocumentKey,
  MIGRATIONS,
  normalizeDocument,
  quarantineDocument,
  readLegacyDocument,
  runMigrations,
} from './document';
import { deserializeTrials, emptyUndoStack, serializeTrials } from './helpers';
import type {
  CreateLabStoreOptions,
  InstrumentSerializers,
  LabDocument,
  LabMode,
  LabStoreState,
  SavedSnapshot,
  TrialRecord,
} from './types';
import {
  dockPanel as dockPanelIn,
  type UndockedPanel,
  undockPanel as undockPanelIn,
} from './undock';

/** Every mutation a lab store supports: managing trials, saving and
 *  restoring snapshots, and setting the color mode. */
export interface LabStoreActions {
  addTrial: (record: Omit<TrialRecord, 'undoStack'>) => void;
  removeTrial: (id: string) => void;
  updateTrialState: <TS>(id: string, next: TS | ((prev: TS) => TS)) => void;
  updateTrialConfig: <TC>(id: string, key: keyof TC, value: TC[keyof TC]) => void;
  updateTrialView: (id: string, view: unknown) => void;
  updateTrialAnnotations: (id: string, doc: unknown) => void;
  updateTrialUndoStack: (
    id: string,
    next: TrialRecord['undoStack'] | ((prev: TrialRecord['undoStack']) => TrialRecord['undoStack']),
  ) => void;
  setTrialInstrument: (id: string, instrumentName: string) => void;
  saveSnapshot: (trialId: string, name: string) => void;
  loadSnapshot: (snapshotId: string, trialId: string) => void;
  deleteSnapshot: (snapshotId: string) => void;
  listSnapshots: (trialId?: string) => SavedSnapshot[];
  setMode: (mode: LabMode) => void;
  setLabTool: (id: string | null) => void;
  setTrialTool: (trialId: string, id: string | null) => void;
  setLayout: (layout: Record<string, unknown>) => void;
  /** Tear a sidebar section out of its trial. Default target is a workspace tile. */
  undockPanel: (trialId: string, sectionId: string, as?: UndockedPanel['as']) => void;
  /** Put one section back, or — with no `sectionId` — every panel the trial owns. */
  dockPanel: (trialId: string, sectionId?: string) => void;
}

/** A lab's store: its state and actions, plus the hook instruments use to
 *  register how their state is serialized. */
export type LabStore = StoreApi<LabStoreState & LabStoreActions> & {
  registerSerializers: (s: InstrumentSerializers) => void;
};

/** Build a lab store, hydrating from storage if anything was saved under the
 *  same key. Writes back are debounced. */
export function createLabStore(options: CreateLabStoreOptions): LabStore {
  let serializers: InstrumentSerializers = {};
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const hydration = hydrateDocument(options);
  const hydrated = hydration.document;
  const persistDisabled = hydration.persistDisabled;
  // Cleared once the legacy keys are actually gone; see the flush.
  let foldedFromLegacy = hydration.foldedFromLegacy;

  const hydratedTrials = deserializeTrials(hydrated.trials, serializers);
  const hydratedSnapshots = hydrated.saves;
  const hydratedLayout = hydrated.layout;
  const hydratedMode = hydrated.mode;

  const store = createStore<LabStoreState & LabStoreActions>()((set, get) => ({
    trials: hydratedTrials,
    savedSnapshots: hydratedSnapshots,
    mode: hydratedMode,
    layout: hydratedLayout,
    undockedPanels: hydrated.undockedPanels,
    activeToolId: null,

    addTrial: (record) => {
      set((s) => ({
        trials: [...s.trials, { ...record, undoStack: emptyUndoStack() }],
      }));
      scheduleFlush();
    },

    removeTrial: (id) => {
      set((s) => ({
        trials: s.trials.filter((w) => w.id !== id),
        undockedPanels: dockPanelIn(s.undockedPanels, id),
      }));
      scheduleFlush();
    },

    updateTrialState: (id, next) => {
      set((s) => ({
        trials: s.trials.map((w) => {
          if (w.id !== id) return w;
          const nextState =
            typeof next === 'function' ? (next as (prev: unknown) => unknown)(w.state) : next;
          // An updater that returns its input means "nothing changed", and must not
          // cost a new record: the trial re-renders on record identity, so
          // allocating here turns the standard React bail-out into a render loop.
          if (Object.is(nextState, w.state)) return w;
          return { ...w, state: nextState };
        }),
      }));
      scheduleFlush();
    },

    updateTrialConfig: (id, key, value) => {
      set((s) => ({
        trials: s.trials.map((w) => {
          if (w.id !== id) return w;
          return {
            ...w,
            config: { ...(w.config as Record<string, unknown>), [key as string]: value },
          };
        }),
      }));
      scheduleFlush();
    },

    updateTrialView: (id, view) => {
      set((s) => ({
        trials: s.trials.map((w) => (w.id === id && !Object.is(view, w.view) ? { ...w, view } : w)),
      }));
      scheduleFlush();
    },

    updateTrialAnnotations: (id, doc) => {
      set((s) => ({
        trials: s.trials.map((w) =>
          w.id === id && !Object.is(doc, w.annotations) ? { ...w, annotations: doc } : w,
        ),
      }));
      scheduleFlush();
    },

    updateTrialUndoStack: (id, next) => {
      set((s) => ({
        trials: s.trials.map((w) => {
          if (w.id !== id) return w;
          const undoStack =
            typeof next === 'function'
              ? (next as (prev: TrialRecord['undoStack']) => TrialRecord['undoStack'])(w.undoStack)
              : next;
          return { ...w, undoStack };
        }),
      }));
    },

    setTrialInstrument: (id, instrumentName) => {
      set((s) => ({
        trials: s.trials.map((w) => (w.id === id ? { ...w, instrumentName } : w)),
      }));
      scheduleFlush();
    },

    saveSnapshot: (trialId, name) => {
      const trial = get().trials.find((w) => w.id === trialId);
      if (!trial) return;
      const reg = serializers[trial.instrumentName];
      const serializedState = reg?.serialize
        ? reg.serialize(trial.state)
        : structuredClone(trial.state);
      const clonedConfig = structuredClone(trial.config);
      const lastAt = get().savedSnapshots.reduce((m, sn) => (sn.savedAt > m ? sn.savedAt : m), 0);
      const savedAt = Math.max(Date.now(), lastAt + 1);
      const snapshot: SavedSnapshot = {
        id: crypto.randomUUID(),
        name,
        trialId,
        instrumentName: trial.instrumentName,
        config: clonedConfig,
        state: serializedState,
        savedAt,
      };
      set((s) => ({ savedSnapshots: [...s.savedSnapshots, snapshot] }));
      scheduleFlush();
    },

    loadSnapshot: (snapshotId, trialId) => {
      const snapshot = get().savedSnapshots.find((sn) => sn.id === snapshotId);
      if (!snapshot) return;
      const trial = get().trials.find((w) => w.id === trialId);
      if (!trial) return;
      if (snapshot.instrumentName !== trial.instrumentName) {
        console.warn(
          `[labkit] loadSnapshot: instrument mismatch (snapshot=${snapshot.instrumentName}, trial=${trial.instrumentName}); refusing to load`,
        );
        return;
      }
      const reg = serializers[snapshot.instrumentName];
      const restoredState = reg?.deserialize ? reg.deserialize(snapshot.state) : snapshot.state;
      set((s) => ({
        trials: s.trials.map((w) =>
          w.id === trialId ? { ...w, state: restoredState, config: snapshot.config } : w,
        ),
      }));
      scheduleFlush();
    },

    deleteSnapshot: (snapshotId) => {
      set((s) => ({
        savedSnapshots: s.savedSnapshots.filter((sn) => sn.id !== snapshotId),
      }));
      scheduleFlush();
    },

    listSnapshots: (trialId) => {
      const all = get().savedSnapshots;
      const filtered = trialId ? all.filter((sn) => sn.trialId === trialId) : all;
      return [...filtered].sort((a, b) => b.savedAt - a.savedAt);
    },

    setMode: (mode) => {
      set({ mode });
      scheduleFlush();
    },

    setLabTool: (id) => set({ activeToolId: id }),

    setTrialTool: (trialId, id) =>
      set((s) => ({
        trials: s.trials.map((t) => (t.id === trialId ? { ...t, activeToolId: id } : t)),
      })),

    undockPanel: (trialId, sectionId, as) => {
      set((s) => ({ undockedPanels: undockPanelIn(s.undockedPanels, trialId, sectionId, as) }));
      scheduleFlush();
    },

    dockPanel: (trialId, sectionId) => {
      set((s) => ({ undockedPanels: dockPanelIn(s.undockedPanels, trialId, sectionId) }));
      scheduleFlush();
    },

    setLayout: (layout) => {
      set({ layout });
      scheduleFlush();
    },
  }));

  function scheduleFlush(): void {
    if (persistDisabled) return;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      const s = store.getState();
      const document: LabDocument = {
        version: CURRENT_DOCUMENT_VERSION,
        trials: serializeTrials(s.trials, serializers),
        saves: s.savedSnapshots,
        layout: s.layout,
        undockedPanels: s.undockedPanels,
        mode: s.mode,
      };
      const serialized = JSON.stringify(document);
      options.storage.write(labDocumentKey(options.storageKey), serialized);
      if (foldedFromLegacy && deleteLegacyKeys(options.storage, options.storageKey, serialized)) {
        foldedFromLegacy = false;
      }
      flushTimer = null;
    }, 300);
  }

  // A lab opened and closed without a single mutation still completes its
  // fold; the flush is what removes the legacy keys.
  if (foldedFromLegacy) scheduleFlush();

  return Object.assign(store, {
    registerSerializers(s: InstrumentSerializers) {
      serializers = s;
    },
  });
}

interface HydrateResult {
  document: LabDocument;
  /** True when flushing would destroy the only copy of something: a document
   *  newer than this code understands, or an unusable one whose quarantine
   *  copy did not land. */
  persistDisabled: boolean;
  foldedFromLegacy: boolean;
}

/** Copy an unusable document aside, and report whether the store may go on
 *  persisting. A failed quarantine write means the copy in storage is the only
 *  one there is, so the store must not overwrite it. */
function setAside(
  options: CreateLabStoreOptions,
  raw: string,
  why: string,
  error?: unknown,
): boolean {
  const quarantined = quarantineDocument(options.storage, options.storageKey, raw);
  const message = quarantined
    ? `[labkit] ${why}; quarantined it and starting empty`
    : `[labkit] ${why} and could not be quarantined; leaving it in place and not persisting`;
  if (error === undefined) console.warn(message);
  else console.warn(message, error);
  return quarantined;
}

function hydrateDocument(options: CreateLabStoreOptions): HydrateResult {
  const fallback = emptyDocument(options.initialMode ?? 'auto');
  const raw = options.storage.read(labDocumentKey(options.storageKey));

  let parsed: Record<string, unknown> | null = null;
  if (raw !== null) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      const persistDisabled = !setAside(options, raw, 'lab document is unparseable');
      return { document: fallback, persistDisabled, foldedFromLegacy: false };
    }
  } else {
    parsed = readLegacyDocument(options.storage, options.storageKey, options.initialMode ?? 'auto');
  }

  if (parsed === null) {
    return { document: fallback, persistDisabled: false, foldedFromLegacy: false };
  }

  const foldedFromLegacy = raw === null;
  const outcome = runMigrations(parsed, MIGRATIONS, CURRENT_DOCUMENT_VERSION);

  if (!outcome.ok) {
    if (outcome.reason === 'future') {
      console.warn(
        '[labkit] lab document is from a newer version of labkit; starting empty and leaving it alone',
      );
      return { document: fallback, persistDisabled: true, foldedFromLegacy: false };
    }
    const stored = JSON.stringify(parsed);
    const persistDisabled = !setAside(
      options,
      stored,
      'lab document failed to migrate',
      outcome.error,
    );
    return { document: fallback, persistDisabled, foldedFromLegacy: false };
  }

  return {
    document: normalizeDocument(outcome.doc, options.initialMode ?? 'auto'),
    persistDisabled: false,
    foldedFromLegacy,
  };
}
