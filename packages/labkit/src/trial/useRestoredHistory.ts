import { createHistory, type History, type Op } from '@weasel-js/core';
import { useEffect } from 'react';
import { useStore } from 'zustand/react';
import { latestStamp, restorableTrialHistory } from '../state/savedUndo';
import type { LabStore } from '../state/store';
import { editStamp, seedEditStamp } from '../undo/editStamp';

/** Rebuilds one of the trial's own saved entries, or answers null for an op it does not own. */
export type RebuildTrialOp = (name: string, args: unknown) => Op | null;

/** A trial's own undo history, holding at most `maxDepth` steps. */
export function trialUndoHistory(maxDepth: number, rebuildOp?: RebuildTrialOp): History {
  return createHistory(null, {
    historyLimit: maxDepth,
    now: editStamp,
    ...(rebuildOp ? { rebuildOp } : {}),
  });
}

/** Saved histories already restored, or set aside for a live one: each is restored once. */
const restored = new WeakSet<object>();

/**
 * Restores the undo history trial `trialId`'s record was read with, once per
 * read: when the lab loads, and when another tab writes the trial. Its entries
 * keep their stamps, and every stamp handed out after is later than theirs.
 */
export function useRestoredHistory(args: {
  store: LabStore;
  trialId: string;
  enabled: boolean;
  maxDepth: number;
  rebuild: RebuildTrialOp;
}): void {
  const { store, trialId, enabled, maxDepth, rebuild } = args;
  const saved = useStore(store, (s) => s.trials.find((t) => t.id === trialId)?.undo?.trial);
  useEffect(() => {
    if (!saved || restored.has(saved)) return;
    restored.add(saved);
    const record = store.getState().trials.find((t) => t.id === trialId);
    if (!enabled || !record || record.history) return;
    const serializer = store.getState().instrumentHooks().serializers[record.instrumentName];
    const data = restorableTrialHistory(saved, serializer);
    const history = trialUndoHistory(maxDepth, rebuild);
    history.restore(data);
    seedEditStamp(latestStamp(data));
    store.getState().setTrialHistory(trialId, history);
  }, [saved, store, trialId, enabled, maxDepth, rebuild]);
}
