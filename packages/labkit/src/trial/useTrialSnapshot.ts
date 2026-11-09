import { type Op, useLatest } from '@weasel-js/core';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand/react';
import type { Instrument } from '../instrument/types';
import { undoCapability } from '../instrument/undo';
import type { LabStore } from '../state/store';
import { onTrialRestart } from '../state/trialRestarts';
import type { TrialRecord } from '../state/types';
import { TRIAL_EDIT_OP, type TrialEditArgs, trialEditOf, trialEditOp } from './trialEditOp';
import type { TrialHistorySource } from './trialHistory';
import { type RebuildTrialOp, trialUndoHistory, useRestoredHistory } from './useRestoredHistory';

/** What a trial snapshots on when its instrument names no events. */
const DEFAULT_SNAPSHOT_ON = ['state.change', 'config.change'];

const isConfigEvent = (event: string): boolean =>
  event === 'config.change' || event.startsWith('config.change:');

/** What `useTrialSnapshot` takes. */
export interface TrialSnapshotOptions {
  store: LabStore;
  trialId: string;
  // biome-ignore lint/suspicious/noExplicitAny: instruments are stored contravariantly; see InstrumentList
  instrument: Instrument<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** The history the instrument handed over with `useTrialHistory`, if any. */
  ownHistory: () => TrialHistorySource | null;
  /** Called when an entry this records is undone. */
  onUndone: () => void;
}

/** Records the trial for undo on an event its instrument snapshots on: its
 *  state and settings, or `op` in their place where the write is to something
 *  else. With a history of the instrument's own mounted, only a settings
 *  change is recorded, onto that history. True when it recorded. */
export type TrialSnapshot = (event: string, op?: Op) => boolean;

/** A trial's undo recorder: what {@link TrialSnapshot} records onto, and the
 *  trial's stored record as the store holds it now. */
export function useTrialSnapshot({
  store,
  trialId,
  instrument,
  ownHistory,
  onUndone,
}: TrialSnapshotOptions): {
  snapshot: TrialSnapshot;
  stored: () => TrialRecord | undefined;
  rebuild: RebuildTrialOp;
} {
  const setTrialHistory = useStore(store, (s) => s.setTrialHistory);
  const undoCap = undoCapability(instrument);
  const undoEvents = useMemo(() => new Set(undoCap?.snapshotOn ?? DEFAULT_SNAPSHOT_ON), [undoCap]);
  const maxDepth = undoCap?.maxDepth ?? 50;
  const undone = useLatest(onUndone);
  // Bumped when the trial starts its undo afresh: an entry recorded before then writes nothing.
  const restarts = useRef(0);
  useEffect(
    () =>
      onTrialRestart(store, trialId, () => {
        restarts.current += 1;
        ownHistory()?.clear?.();
      }),
    [store, trialId, ownHistory],
  );

  // Read from the store, not the render: a caller may write several times
  // before the next render, and each write has to build on the one before.
  const stored = useCallback(
    (): TrialRecord | undefined => store.getState().trials.find((t) => t.id === trialId),
    [store, trialId],
  );

  /** `entry` as the trial records it: ending the gesture when undone, and fenced at the restart it
   *  was recorded or restored under. */
  const recorded = useCallback(
    (entry: Op): Op => {
      const at = restarts.current;
      return fenced(
        {
          ...entry,
          invert: () => {
            undone.current();
            return entry.invert();
          },
        },
        () => restarts.current === at,
      );
    },
    [undone],
  );

  const rebuild = useCallback<RebuildTrialOp>(
    (name, args) =>
      name === TRIAL_EDIT_OP ? recorded(trialEditOp(args as TrialEditArgs, store, trialId)) : null,
    [recorded, store, trialId],
  );

  useRestoredHistory({ store, trialId, enabled: undoCap !== undefined, maxDepth, rebuild });

  const snapshot = useCallback<TrialSnapshot>(
    (event, op) => {
      if (!undoCap || !undoEvents.has(event)) return false;
      const current = stored();
      if (!current) return false;
      const own = ownHistory();
      if (own && !isConfigEvent(event)) return false;
      const entry = recorded(op ?? trialEditOf(current, own ? 'settings' : 'edit', store));
      if (own) {
        own.record(entry, event);
        return true;
      }
      let history = current.history;
      if (!history) {
        history = trialUndoHistory(maxDepth);
        setTrialHistory(trialId, history);
      }
      history.recordEntry([entry], event);
      return true;
    },
    [undoCap, undoEvents, maxDepth, stored, ownHistory, store, trialId, setTrialHistory, recorded],
  );

  return { snapshot, stored, rebuild };
}

/** `op`, writing nothing once `live` says the trial has restarted since it was recorded. */
function fenced(op: Op, live: () => boolean): Op {
  return {
    ...op,
    apply: (adapter) => (live() ? op.apply(adapter) : 'noop'),
    invert: () => fenced(op.invert(), live),
  };
}
