import { createStore, type StoreApi } from 'zustand/vanilla';
import { fillConfigDefaults, withValueAtPath } from '../config/path';
import { emptyDocument } from './document';
import { deserializeTrials, emptyUndoStack, newId } from './helpers';
import type {
  CreateLabStoreOptions,
  InstrumentSerializers,
  LabMode,
  LabStoreState,
  SavedSnapshot,
  SerializedTrial,
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
  /** Write one config value. `path` is dotted for a value nested under an
   *  `f.group`, and the bare key for one at the root. */
  updateTrialConfig: (id: string, path: string, value: unknown) => void;
  updateTrialView: (id: string, view: unknown) => void;
  updateTrialSidebarWidth: (id: string, width: number) => void;
  /** Retitle a trial. `null` returns it to its instrument's name. */
  setTrialTitle: (id: string, title: string | null) => void;
  /** Fold or unfold one of a trial's sections. */
  setTrialSectionCollapsed: (id: string, key: string, collapsed: boolean) => void;
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

/** A lab's store: its state and its actions. How each instrument's state is
 *  serialized comes in through `CreateLabStoreOptions.serializers`. */
export type LabStore = StoreApi<LabStoreState & LabStoreActions>;

/** Build a lab store holding `initial`, or an empty lab. It knows nothing
 *  about storage; `openLabStore` reads a stored lab and binds one of these to
 *  it. */
export function createLabStore(options: CreateLabStoreOptions = {}): LabStore {
  const serializers = options.serializers ?? {};
  const initial = options.initial ?? emptyDocument(options.initialMode ?? 'auto');

  const store = createStore<LabStoreState & LabStoreActions>()((set, get) => ({
    trials: hydrateTrials(initial.trials, serializers, options.configDefaults),
    savedSnapshots: hydrateSnapshots(initial.saves, options.configDefaults),
    mode: initial.mode,
    layout: initial.layout,
    undockedPanels: initial.undockedPanels,
    activeToolId: null,

    addTrial: (record) => {
      set((s) => ({
        trials: [...s.trials, { ...record, undoStack: emptyUndoStack() }],
      }));
    },

    removeTrial: (id) => {
      set((s) => ({
        trials: s.trials.filter((w) => w.id !== id),
        undockedPanels: dockPanelIn(s.undockedPanels, id),
      }));
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
    },

    updateTrialConfig: (id, path, value) => {
      set((s) => ({
        trials: s.trials.map((w) =>
          w.id === id ? { ...w, config: withValueAtPath(w.config, path, value) } : w,
        ),
      }));
    },

    updateTrialView: (id, view) => {
      set((s) => ({
        trials: s.trials.map((w) => (w.id === id && !Object.is(view, w.view) ? { ...w, view } : w)),
      }));
    },

    updateTrialSidebarWidth: (id, width) => {
      set((s) => ({
        trials: s.trials.map((w) =>
          w.id === id && w.sidebarWidth !== width ? { ...w, sidebarWidth: width } : w,
        ),
      }));
    },

    setTrialTitle: (id, title) => {
      set((s) => ({
        trials: s.trials.map((w) => {
          if (w.id !== id) return w;
          const next = title === null ? undefined : title;
          if ((w.title ?? undefined) === next) return w;
          return { ...w, title: next };
        }),
      }));
    },

    setTrialSectionCollapsed: (id, key, collapsed) => {
      set((s) => ({
        trials: s.trials.map((w) => {
          if (w.id !== id) return w;
          if (w.collapsedSections?.[key] === collapsed) return w;
          return { ...w, collapsedSections: { ...w.collapsedSections, [key]: collapsed } };
        }),
      }));
    },

    updateTrialAnnotations: (id, doc) => {
      set((s) => ({
        trials: s.trials.map((w) =>
          w.id === id && !Object.is(doc, w.annotations) ? { ...w, annotations: doc } : w,
        ),
      }));
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
        id: newId(),
        name,
        trialId,
        instrumentName: trial.instrumentName,
        config: clonedConfig,
        state: serializedState,
        savedAt,
      };
      set((s) => ({ savedSnapshots: [...s.savedSnapshots, snapshot] }));
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
      const restoredState = reg?.deserialize
        ? reg.deserialize(snapshot.state, snapshot.config)
        : snapshot.state;
      set((s) => ({
        trials: s.trials.map((w) =>
          w.id === trialId ? { ...w, state: restoredState, config: snapshot.config } : w,
        ),
      }));
    },

    deleteSnapshot: (snapshotId) => {
      set((s) => ({
        savedSnapshots: s.savedSnapshots.filter((sn) => sn.id !== snapshotId),
      }));
    },

    listSnapshots: (trialId) => {
      const all = get().savedSnapshots;
      const filtered = trialId ? all.filter((sn) => sn.trialId === trialId) : all;
      return [...filtered].sort((a, b) => b.savedAt - a.savedAt);
    },

    setMode: (mode) => {
      set({ mode });
    },

    setLabTool: (id) => set({ activeToolId: id }),

    setTrialTool: (trialId, id) =>
      set((s) => ({
        trials: s.trials.map((t) => (t.id === trialId ? { ...t, activeToolId: id } : t)),
      })),

    undockPanel: (trialId, sectionId, as) => {
      set((s) => ({ undockedPanels: undockPanelIn(s.undockedPanels, trialId, sectionId, as) }));
    },

    dockPanel: (trialId, sectionId) => {
      set((s) => ({ undockedPanels: dockPanelIn(s.undockedPanels, trialId, sectionId) }));
    },

    setLayout: (layout) => {
      set({ layout });
    },
  }));

  return store;
}

function filledConfig(
  configDefaults: Record<string, () => unknown>,
  instrumentName: string,
  config: unknown,
): unknown {
  const defaults = configDefaults[instrumentName];
  return defaults ? fillConfigDefaults(config, defaults()) : config;
}

/** Rebuild stored trials: fill each config's gaps from its instrument's
 *  defaults, then run the deserializer against the filled config. */
export function hydrateTrials(
  trials: SerializedTrial[],
  serializers: InstrumentSerializers,
  configDefaults: Record<string, () => unknown> = {},
): TrialRecord[] {
  return deserializeTrials(
    trials.map((t) => ({ ...t, config: filledConfig(configDefaults, t.instrumentName, t.config) })),
    serializers,
  );
}

/** Fill each stored snapshot's config the way `hydrateTrials` fills a trial's. */
export function hydrateSnapshots(
  saves: SavedSnapshot[],
  configDefaults: Record<string, () => unknown> = {},
): SavedSnapshot[] {
  return saves.map((sn) => ({
    ...sn,
    config: filledConfig(configDefaults, sn.instrumentName, sn.config),
  }));
}
