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
import { deserializeWorkspaces, emptyUndoStack, serializeWorkspaces } from './helpers';
import type {
  CreateLabStoreOptions,
  InstrumentSerializers,
  LabDocument,
  LabMode,
  LabStoreState,
  SavedSnapshot,
  WorkspaceRecord,
} from './types';

/** Every mutation a lab store supports: managing workspaces, saving and
 *  restoring snapshots, and setting the color mode. */
export interface LabStoreActions {
  addWorkspace: (record: Omit<WorkspaceRecord, 'undoStack'>) => void;
  removeWorkspace: (id: string) => void;
  updateWorkspaceState: <TS>(id: string, next: TS | ((prev: TS) => TS)) => void;
  updateWorkspaceConfig: <TC>(id: string, key: keyof TC, value: TC[keyof TC]) => void;
  updateWorkspaceView: (id: string, view: WorkspaceRecord['view']) => void;
  updateWorkspaceUndoStack: (
    id: string,
    next:
      | WorkspaceRecord['undoStack']
      | ((prev: WorkspaceRecord['undoStack']) => WorkspaceRecord['undoStack']),
  ) => void;
  setWorkspaceInstrument: (id: string, instrumentName: string) => void;
  saveSnapshot: (workspaceId: string, name: string) => void;
  loadSnapshot: (snapshotId: string, workspaceId: string) => void;
  deleteSnapshot: (snapshotId: string) => void;
  listSnapshots: (workspaceId?: string) => SavedSnapshot[];
  setMode: (mode: LabMode) => void;
  setLayout: (layout: Record<string, unknown>) => void;
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

  const hydratedWorkspaces = deserializeWorkspaces(hydrated.workspaces, serializers);
  const hydratedSnapshots = hydrated.saves;
  const hydratedLayout = hydrated.layout;
  const hydratedMode = hydrated.mode;

  const store = createStore<LabStoreState & LabStoreActions>()((set, get) => ({
    workspaces: hydratedWorkspaces,
    savedSnapshots: hydratedSnapshots,
    mode: hydratedMode,
    layout: hydratedLayout,

    addWorkspace: (record) => {
      set((s) => ({
        workspaces: [...s.workspaces, { ...record, undoStack: emptyUndoStack() }],
      }));
      scheduleFlush();
    },

    removeWorkspace: (id) => {
      set((s) => ({ workspaces: s.workspaces.filter((w) => w.id !== id) }));
      scheduleFlush();
    },

    updateWorkspaceState: (id, next) => {
      set((s) => ({
        workspaces: s.workspaces.map((w) => {
          if (w.id !== id) return w;
          const nextState =
            typeof next === 'function' ? (next as (prev: unknown) => unknown)(w.state) : next;
          return { ...w, state: nextState };
        }),
      }));
      scheduleFlush();
    },

    updateWorkspaceConfig: (id, key, value) => {
      set((s) => ({
        workspaces: s.workspaces.map((w) => {
          if (w.id !== id) return w;
          return {
            ...w,
            config: { ...(w.config as Record<string, unknown>), [key as string]: value },
          };
        }),
      }));
      scheduleFlush();
    },

    updateWorkspaceView: (id, view) => {
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, view } : w)),
      }));
      scheduleFlush();
    },

    updateWorkspaceUndoStack: (id, next) => {
      set((s) => ({
        workspaces: s.workspaces.map((w) => {
          if (w.id !== id) return w;
          const undoStack =
            typeof next === 'function'
              ? (next as (prev: WorkspaceRecord['undoStack']) => WorkspaceRecord['undoStack'])(
                  w.undoStack,
                )
              : next;
          return { ...w, undoStack };
        }),
      }));
    },

    setWorkspaceInstrument: (id, instrumentName) => {
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, instrumentName } : w)),
      }));
      scheduleFlush();
    },

    saveSnapshot: (workspaceId, name) => {
      const workspace = get().workspaces.find((w) => w.id === workspaceId);
      if (!workspace) return;
      const reg = serializers[workspace.instrumentName];
      const serializedState = reg?.serialize
        ? reg.serialize(workspace.state)
        : structuredClone(workspace.state);
      const clonedConfig = structuredClone(workspace.config);
      const lastAt = get().savedSnapshots.reduce((m, sn) => (sn.savedAt > m ? sn.savedAt : m), 0);
      const savedAt = Math.max(Date.now(), lastAt + 1);
      const snapshot: SavedSnapshot = {
        id: crypto.randomUUID(),
        name,
        workspaceId,
        instrumentName: workspace.instrumentName,
        config: clonedConfig,
        state: serializedState,
        savedAt,
      };
      set((s) => ({ savedSnapshots: [...s.savedSnapshots, snapshot] }));
      scheduleFlush();
    },

    loadSnapshot: (snapshotId, workspaceId) => {
      const snapshot = get().savedSnapshots.find((sn) => sn.id === snapshotId);
      if (!snapshot) return;
      const workspace = get().workspaces.find((w) => w.id === workspaceId);
      if (!workspace) return;
      if (snapshot.instrumentName !== workspace.instrumentName) {
        console.warn(
          `[labkit] loadSnapshot: instrument mismatch (snapshot=${snapshot.instrumentName}, workspace=${workspace.instrumentName}); refusing to load`,
        );
        return;
      }
      const reg = serializers[snapshot.instrumentName];
      const restoredState = reg?.deserialize ? reg.deserialize(snapshot.state) : snapshot.state;
      set((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === workspaceId ? { ...w, state: restoredState, config: snapshot.config } : w,
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

    listSnapshots: (workspaceId) => {
      const all = get().savedSnapshots;
      const filtered = workspaceId ? all.filter((sn) => sn.workspaceId === workspaceId) : all;
      return [...filtered].sort((a, b) => b.savedAt - a.savedAt);
    },

    setMode: (mode) => {
      set({ mode });
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
        workspaces: serializeWorkspaces(s.workspaces, serializers),
        saves: s.savedSnapshots,
        layout: s.layout,
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
