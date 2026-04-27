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
  LabStoreState,
  SavedSnapshot,
  WorkspaceRecord,
} from './types';

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
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

export type LabStore = StoreApi<LabStoreState & LabStoreActions> & {
  registerSerializers: (s: InstrumentSerializers) => void;
};

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

  const themeRaw = options.storage.read(labStorageKey(options.storageKey, 'theme'));
  let hydratedTheme: 'light' | 'dark' | 'auto';
  if (themeRaw === 'light' || themeRaw === 'dark' || themeRaw === 'auto') {
    hydratedTheme = themeRaw;
  } else {
    hydratedTheme = options.initialTheme ?? 'auto';
  }

  const store = createStore<LabStoreState & LabStoreActions>()((set, get) => ({
    workspaces: hydratedWorkspaces,
    savedSnapshots: hydratedSnapshots,
    theme: hydratedTheme,

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

    setTheme: (theme) => {
      set({ theme });
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
      options.storage.write(labStorageKey(options.storageKey, 'theme'), s.theme);
      flushTimer = null;
    }, 300);
  }

  return Object.assign(store, {
    registerSerializers(s: InstrumentSerializers) {
      serializers = s;
    },
  });
}
