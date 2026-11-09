import type { InstrumentList } from '../instrument/types';
import { resetTrial as resetTrialOp } from '../trial/trialOps';
import { loadedFrom, snapshotOf } from './snapshots';
import { announceTrialRestart } from './trialRestarts';
import type { InstrumentHooks, LabStoreState, SavedSnapshot, TrialRecord } from './types';

/** The store's actions that save a trial, or put one back: to a snapshot, or to what it opened on. */
export interface SnapshotActions {
  saveSnapshot: (trialId: string, name: string) => void;
  /** Load a snapshot over a trial, starting its undo afresh. */
  loadSnapshot: (snapshotId: string, trialId: string) => void;
  deleteSnapshot: (snapshotId: string) => void;
  listSnapshots: (trialId?: string) => SavedSnapshot[];
  /** Return a trial to what it opened on under `instruments`, keeping its id, place and marks,
   *  and start its undo afresh. */
  resetTrial: (trialId: string, instruments: InstrumentList) => void;
}

/** {@link SnapshotActions} writing through the store's `set`, announcing on `api`, and reading the
 *  instrument hooks in force at each call. */
export function snapshotActions(
  set: (next: (s: LabStoreState) => Partial<LabStoreState>) => void,
  get: () => LabStoreState,
  api: object,
  hooks: () => InstrumentHooks,
): SnapshotActions {
  const restarted = (trialId: string): void => announceTrialRestart(api, trialId);
  return {
    saveSnapshot: (trialId, name) => {
      const trial = get().trials.find((w) => w.id === trialId);
      if (!trial) return;
      const snapshot = snapshotOf(trial, name, hooks(), get().savedSnapshots);
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
        trials: s.trials.map((w) => (w.id === trialId ? loadedFrom(w, snapshot, hooks()) : w)),
      }));
      restarted(trialId);
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

    resetTrial: (trialId, instruments) => {
      const record = resetTrialOp(get().trials, trialId, instruments).find((w) => w.id === trialId);
      if (!record) return;
      set((s) => ({
        trials: s.trials.map((w) => {
          if (w.id !== trialId) return w;
          const { auto: _pinnedNow, history: _history, undo: _undo, ...kept } = w;
          const reset: TrialRecord = {
            ...kept,
            config: record.config,
            state: record.state,
            view: record.view,
          };
          if (record.auto) reset.auto = record.auto;
          return reset;
        }),
      }));
      restarted(trialId);
    },
  };
}
