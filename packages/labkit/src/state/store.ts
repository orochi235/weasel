import type { StateCreator, StoreApi } from 'zustand/vanilla';
import { createStore } from 'zustand/vanilla';
import type { InstrumentList } from '../instrument/types';
import { emptyDocument } from './document';
import { hydrateSnapshots, hydrateTrials, rehydrated, withoutUnreadable } from './hydrate';
import { changedInstruments, initialHooks, mergedHooks } from './instrumentHooks';
import { type SnapshotActions, snapshotActions } from './snapshotActions';
import { type TrialRecordActions, trialRecordActions } from './trialRecordActions';
import type {
  CreateLabStoreOptions,
  InstrumentHooks,
  LabMode,
  LabStoreState,
  UnreadableRecord,
} from './types';
import {
  dockingDepartedTrials,
  dockPanel as dockPanelIn,
  type UndockedPanel,
  undockPanel as undockPanelIn,
} from './undock';

/** Every mutation a lab store supports: managing trials, saving and
 *  restoring snapshots, resetting a trial, and setting the color mode. */
export interface LabStoreActions extends SnapshotActions, TrialRecordActions {
  setMode: (mode: LabMode) => void;
  setLabTool: (id: string | null) => void;
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

  const init: StateCreator<LabStoreState & LabStoreActions> = (set, get, api) => ({
    ...loaded,
    activeToolId: null,
    instruments: options.instruments ?? null,

    ...trialRecordActions(set),
    ...snapshotActions(set, get, api, () => hooks),

    setMode: (mode) => {
      set({ mode });
    },

    setLabTool: (id) => set({ activeToolId: id }),

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
      const changed = changedInstruments(before, instruments);
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
