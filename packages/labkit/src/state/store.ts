import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  deserializeWorkspaces,
  emptyUndoStack,
  labStorageKey,
  serializeWorkspaces,
} from './helpers';
import type {
  CreateLabStoreOptions,
  InstrumentSerializers,
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

  const workspacesRaw = options.storage.read(labStorageKey(options.storageKey, 'workspaces'));
  let hydratedWorkspaces: WorkspaceRecord[] = [];
  if (workspacesRaw) {
    hydratedWorkspaces = deserializeWorkspaces(workspacesRaw, serializers);
  }

  const savesRaw = options.storage.read(labStorageKey(options.storageKey, 'saves'));
  let hydratedSnapshots: SavedSnapshot[] = [];
  if (savesRaw) {
    try {
      hydratedSnapshots = JSON.parse(savesRaw) as SavedSnapshot[];
    } catch {
      console.warn('[labkit] failed to parse saved snapshots, starting empty');
      hydratedSnapshots = [];
    }
  }

  const layoutRaw = options.storage.read(labStorageKey(options.storageKey, 'layout'));
  let hydratedLayout: Record<string, unknown> = {};
  if (layoutRaw) {
    try {
      hydratedLayout = JSON.parse(layoutRaw) as Record<string, unknown>;
    } catch {
      console.warn('[labkit] failed to parse saved layout, starting empty');
      hydratedLayout = {};
    }
  }

  const modeRaw = options.storage.read(labStorageKey(options.storageKey, 'theme'));
  // `interstellar` was the dark mode's name back when it was a theme.
  const stored = modeRaw === 'interstellar' ? 'dark' : modeRaw;
  let hydratedMode: LabMode;
  if (stored === 'light' || stored === 'dark' || stored === 'auto') {
    hydratedMode = stored;
  } else {
    hydratedMode = options.initialMode ?? 'auto';
  }

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
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      const s = store.getState();
      options.storage.write(
        labStorageKey(options.storageKey, 'workspaces'),
        serializeWorkspaces(s.workspaces, serializers),
      );
      options.storage.write(
        labStorageKey(options.storageKey, 'saves'),
        JSON.stringify(s.savedSnapshots),
      );
      options.storage.write(labStorageKey(options.storageKey, 'theme'), s.mode);
      options.storage.write(labStorageKey(options.storageKey, 'layout'), JSON.stringify(s.layout));
      flushTimer = null;
    }, 300);
  }

  return Object.assign(store, {
    registerSerializers(s: InstrumentSerializers) {
      serializers = s;
    },
  });
}
