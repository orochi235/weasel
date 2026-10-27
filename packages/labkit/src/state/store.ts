import type { History } from '@weasel-js/core';
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';
import type { ClockPosition } from '../clock/trialClock';
import { applyConfigWrite } from '../config/autoConfig';
import {
  configDefaultsOf,
  configMigrationsOf,
  configSchemasOf,
  serializersOf,
} from '../instrument/serializers';
import type { InstrumentList } from '../instrument/types';
import { emptyDocument } from './document';
import { loadedFrom, snapshotOf } from './snapshots';
import { hydrateSnapshots, hydrateTrials, rehydrated, withoutUnreadable } from './hydrate';
import type {
  CreateLabStoreOptions,
  InstrumentHooks,
  LabMode,
  LabStoreState,
  SavedSnapshot,
  TrialRecord,
  UnreadableRecord,
} from './types';
import {
  dockingDepartedTrials,
  dockPanel as dockPanelIn,
  type UndockedPanel,
  undockPanel as undockPanelIn,
} from './undock';

/** Every mutation a lab store supports: managing trials, saving and
 *  restoring snapshots, and setting the color mode. */
export interface LabStoreActions {
  addTrial: (record: Omit<TrialRecord, 'history'>) => void;
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
  /** Give a trial the undo history it made on its first snapshot. */
  setTrialHistory: (id: string, history: History) => void;
  /** Record where a trial's clock stands. */
  updateTrialClock: (id: string, clock: ClockPosition) => void;
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
  /** Replace the lab's instruments. Trials and saves of an instrument that is
   *  new or a different object are brought up to date against it in the same
   *  write; every other trial keeps its object. */
  setInstruments: (instruments: InstrumentList) => void;
  /** Delete the record of a trial or snapshot that failed to load. */
  discardUnreadable: (kind: UnreadableRecord['kind'], id: string) => void;
  /** The per-instrument hooks in force now. Read them at use; never keep them. */
  instrumentHooks: () => InstrumentHooks;
}

/** A lab's store: its state and its actions. How each instrument's state is
 *  serialized comes in through `CreateLabStoreOptions.instruments`. */
export type LabStore = StoreApi<LabStoreState & LabStoreActions>;

/** Build a lab store holding `initial`, or an empty lab. It knows nothing
 *  about storage; `openLabStore` reads a stored lab and binds one of these to
 *  it. */
export function createLabStore(options: CreateLabStoreOptions = {}): LabStore {
  let hooks = initialHooks(options);
  const loaded = loadedState(options, hooks);

  const init: StateCreator<LabStoreState & LabStoreActions> = (set, get) => ({
    ...loaded,
    activeToolId: null,
    instruments: options.instruments ?? null,

    addTrial: (record) => {
      set((s) => ({
        trials: [...s.trials, record],
      }));
    },

    removeTrial: (id) => {
      set((s) => ({ trials: s.trials.filter((w) => w.id !== id) }));
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
        trials: s.trials.map((w) => {
          if (w.id !== id) return w;
          const was = w.auto ?? [];
          // The sentinel is never stored: it becomes membership in `auto`, and
          // the pinned value at the path is left exactly where it is.
          const next = applyConfigWrite(w.config, was, path, value);
          if (next.config === w.config && next.autoPaths === was) return w;
          const { auto: _was, ...kept } = w;
          const record: TrialRecord = { ...kept, config: next.config };
          if (next.autoPaths.length > 0) record.auto = next.autoPaths;
          return record;
        }),
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

    updateTrialClock: (id, clock) => {
      set((s) => ({
        trials: s.trials.map((w) => (w.id === id ? { ...w, clock } : w)),
      }));
    },
    setTrialHistory: (id, history) => {
      set((s) => ({
        trials: s.trials.map((w) => (w.id === id ? { ...w, history } : w)),
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
      const snapshot = snapshotOf(trial, name, hooks, get().savedSnapshots);
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
      set((s) => ({
        trials: s.trials.map((w) => (w.id === trialId ? loadedFrom(w, snapshot, hooks) : w)),
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

    setTrialTool: (trialId, id) => set((s) => trialToolSet(s, trialId, id)),

    undockPanel: (trialId, sectionId, as) => {
      set((s) => ({ undockedPanels: undockPanelIn(s.undockedPanels, trialId, sectionId, as) }));
    },

    dockPanel: (trialId, sectionId) => {
      set((s) => ({ undockedPanels: dockPanelIn(s.undockedPanels, trialId, sectionId) }));
    },

    setLayout: (layout) => {
      set({ layout });
    },

    setInstruments: (instruments) => {
      const before = get().instruments;
      if (before === instruments) return;
      const next = mergedHooks(hooks, instruments);
      const previous = new Map((before ?? []).map((i) => [i.name, i]));
      const changed = new Set(
        instruments.filter((i) => previous.get(i.name) !== i).map((i) => i.name),
      );
      if (changed.size === 0) {
        hooks = next;
        set({ instruments });
        return;
      }
      const s = get();
      const trials = s.trials.map((w) =>
        changed.has(w.instrumentName) ? rehydrated('trial', w, next) : w,
      );
      const savedSnapshots = s.savedSnapshots.map((sn) =>
        changed.has(sn.instrumentName) ? rehydrated('snapshot', sn, next) : sn,
      );
      hooks = next;
      set({ instruments, trials, savedSnapshots });
    },

    discardUnreadable: (kind, id) => {
      set((s) => ({ unreadable: withoutUnreadable(s.unreadable, kind, id) }));
    },

    instrumentHooks: () => hooks,
  });
  const store = createStore<LabStoreState & LabStoreActions>()(dockingDepartedTrials(init));

  return store;
}

// A write of the tool a trial already holds must notify no one: the canvas a
// trial's tool slot mirrors answers every notice with a write of its own.
function trialToolSet<S extends LabStoreState>(
  s: S,
  trialId: string,
  id: string | null,
): S | Pick<S, 'trials'> {
  return holdsTool(s.trials, trialId, id) ? s : { trials: withTool(s.trials, trialId, id) };
}

function holdsTool(trials: readonly TrialRecord[], trialId: string, id: string | null): boolean {
  return !trials.some((t) => t.id === trialId && t.activeToolId !== id);
}

function withTool(
  trials: readonly TrialRecord[],
  trialId: string,
  id: string | null,
): TrialRecord[] {
  return trials.map((t) => (t.id === trialId ? { ...t, activeToolId: id } : t));
}

function initialHooks(options: CreateLabStoreOptions): InstrumentHooks {
  if (options.instruments) return hooksOf(options.instruments);
  return {
    serializers: options.serializers ?? {},
    configDefaults: options.configDefaults ?? {},
    configMigrations: options.configMigrations ?? {},
    configSchemas: options.configSchemas ?? {},
  };
}

/** The document a store opens on, hydrated, with what failed to load listed. */
function loadedState(
  options: CreateLabStoreOptions,
  hooks: InstrumentHooks,
): Pick<
  LabStoreState,
  'trials' | 'savedSnapshots' | 'unreadable' | 'mode' | 'layout' | 'undockedPanels'
> {
  const initial = options.initial ?? emptyDocument(options.initialMode ?? 'auto');
  const unreadable: UnreadableRecord[] = [];
  const failed = (record: UnreadableRecord): void => {
    unreadable.push(record);
  };
  return {
    trials: hydrateTrials(initial.trials, hooks.serializers, hooks, failed),
    savedSnapshots: hydrateSnapshots(initial.saves, hooks, failed),
    unreadable,
    mode: initial.mode,
    layout: initial.layout,
    undockedPanels: initial.undockedPanels,
  };
}

function hooksOf(instruments: InstrumentList): InstrumentHooks {
  return {
    serializers: serializersOf(instruments),
    configDefaults: configDefaultsOf(instruments),
    configSchemas: configSchemasOf(instruments),
    configMigrations: configMigrationsOf(instruments),
  };
}

/** Hooks for `instruments`, keeping those of any instrument no longer listed:
 *  its trials stay open, and their state still has to round-trip. A listed
 *  name takes its hooks wholly from the new list. */
function mergedHooks(old: InstrumentHooks, instruments: InstrumentList): InstrumentHooks {
  const listed = new Set(instruments.map((i) => i.name));
  const fresh = hooksOf(instruments);
  const unlisted = <T>(entries: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(entries).filter(([name]) => !listed.has(name)));
  return {
    serializers: { ...unlisted(old.serializers), ...fresh.serializers },
    configDefaults: { ...unlisted(old.configDefaults), ...fresh.configDefaults },
    configSchemas: { ...unlisted(old.configSchemas), ...fresh.configSchemas },
    configMigrations: { ...unlisted(old.configMigrations), ...fresh.configMigrations },
  };
}
