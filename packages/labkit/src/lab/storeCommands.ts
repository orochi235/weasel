import type { ClockRegistry } from '@weasel-js/clock';
import { useMemo } from 'react';
import { useStore } from 'zustand/react';
import type { ConfigRule, ControlRenderer } from '../config/types';
import type { InstrumentList } from '../instrument/types';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import {
  addTrial as addTrialOp,
  cloneTrial as cloneTrialOp,
  closeTrial as closeTrialOp,
  reorderTrials as reorderTrialsOp,
  resetTrial as resetTrialOp,
  swapTrial as swapTrialOp,
} from '../trial/trialOps';
import type { LabCommands } from './LabContext';
import type { TrialLayout } from './Workspace';

/** What a lab's commands read besides its store. */
export interface StoreCommandsOptions {
  instruments: InstrumentList;
  clocks: ClockRegistry;
  focusedTrialId: string | null;
  /** Move the focus to a trial: one a command opened, or put in the focused one's place. */
  focus(id: string): void;
  configRules?: readonly ConfigRule[] | undefined;
  controls?: Record<string, ControlRenderer> | undefined;
  marks: boolean;
  setMarks: (shown: boolean) => void;
}

/** A lab's commands, each written against `store`. */
export function useStoreCommands(
  store: LabStore,
  {
    instruments,
    clocks,
    focusedTrialId,
    focus,
    configRules,
    controls,
    marks,
    setMarks,
  }: StoreCommandsOptions,
): LabCommands {
  const savedSnapshots = useStore(store, (s) => s.savedSnapshots);
  const mode = useStore(store, (s) => s.mode);
  return useMemo<LabCommands>(() => {
    const replaceTrials = (next: TrialRecord[]): void => {
      const currentById = new Map(store.getState().trials.map((w) => [w.id, w]));
      const merged = next.map((w) => currentById.get(w.id) ?? w);
      store.setState({ trials: merged });
    };
    const replaceAndFocusAdded = (next: TrialRecord[]): void => {
      const before = new Set(store.getState().trials.map((w) => w.id));
      replaceTrials(next);
      const added = next.find((w) => !before.has(w.id));
      if (added) focus(added.id);
    };

    return {
      instruments,
      addTrial: (instrumentName, options) => {
        replaceAndFocusAdded(
          addTrialOp(store.getState().trials, instruments, instrumentName, options),
        );
      },
      cloneTrial: (id) => {
        replaceAndFocusAdded(cloneTrialOp(store.getState().trials, id));
      },
      closeTrial: (id) => {
        const current = store.getState();
        // A lab keeps its last trial; `closeTrialOp` is what says whether this is it.
        if (closeTrialOp(current.trials, id) !== current.trials) current.removeTrial(id);
      },
      reorderTrials: (ids) => {
        replaceTrials(reorderTrialsOp(store.getState().trials, ids));
      },
      swapTrial: (id, instrumentName, options) => {
        const current = store.getState();
        const next = swapTrialOp(current.trials, instruments, id, instrumentName, options);
        if (next === current.trials) return;
        const record = next[current.trials.findIndex((w) => w.id === id)] as TrialRecord;
        // Written before the tile registers, which is when the grid reads it.
        const { [id]: extent, ...layoutRest } = current.layout as TrialLayout;
        if (extent) current.setLayout({ ...layoutRest, [record.id]: extent });
        replaceTrials(next);
        if (focusedTrialId === id) focus(record.id);
      },
      focusedTrialId,
      focusTrial: focus,
      resetTrial: (id) => {
        const next = resetTrialOp(store.getState().trials, id, instruments);
        const record = next.find((w) => w.id === id);
        if (!record) return;
        store.setState((s) => ({
          trials: s.trials.map((w) => {
            if (w.id !== id) return w;
            const { auto: _pinnedNow, ...kept } = w;
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
        const handle = clocks.get(id);
        // The lab's clock is every trial's on it, so resetting one leaves it.
        if (handle !== clocks.shared) handle?.reset();
      },
      savedSnapshots,
      saveSnapshot: (trialId, name) => {
        const taken = store.getState().savedSnapshots.filter((s) => s.trialId === trialId).length;
        store.getState().saveSnapshot(trialId, name ?? `Snapshot ${taken + 1}`);
      },
      loadSnapshot: (trialId, snapshotId) => {
        store.getState().loadSnapshot(snapshotId, trialId);
      },
      deleteSnapshot: (snapshotId) => {
        store.getState().deleteSnapshot(snapshotId);
      },
      mode,
      setMode: (m) => {
        store.getState().setMode(m);
      },
      marks,
      setMarks,
      configRules,
      controls,
    };
  }, [
    clocks,
    instruments,
    focusedTrialId,
    focus,
    savedSnapshots,
    mode,
    store,
    configRules,
    controls,
    marks,
    setMarks,
  ]);
}
