import {
  type ClockRegistry,
  clockPosition,
  holdElapsed,
  type PlayheadHold,
} from '@weasel-js/clock';
import { useEffect, useState } from 'react';
import { declaredClock } from '../clock/trialClock';
import type { InstrumentList } from '../instrument/types';
import type { LabStore } from '../state/store';
import type { LabCommands } from './LabContext';

/**
 * A lab's snapshot save and load, which also carry a trial's own clock: a save
 * records where the clock stands now, and a load holds it at the saved
 * `elapsed`, in the pass it stood in.
 * `holds` keeps each trial's load hold, released by the next load or once
 * the trial is gone ({@link useLoadHolds}).
 */
export function snapshotCommands(
  store: LabStore,
  clocks: ClockRegistry,
  instruments: InstrumentList,
  holds: Map<string, PlayheadHold>,
): Pick<LabCommands, 'saveSnapshot' | 'loadSnapshot'> {
  const ownClock = (trialId: string) => {
    const handle = clocks.get(trialId);
    return handle && handle !== clocks.shared ? handle : null;
  };
  return {
    saveSnapshot: (trialId, name) => {
      const current = store.getState();
      const taken = current.savedSnapshots.filter((s) => s.trialId === trialId).length;
      const handle = ownClock(trialId);
      const trial = current.trials.find((w) => w.id === trialId);
      const instrument = instruments.find((i) => i.name === trial?.instrumentName);
      // The record lags a playing clock, and holds nothing for one never moved.
      if (handle && trial && instrument) {
        const spec = declaredClock(instrument, trial.config);
        current.updateTrialClock(
          trialId,
          clockPosition(handle.clock, spec?.duration, spec?.origin),
        );
      }
      store.getState().saveSnapshot(trialId, name ?? `Snapshot ${taken + 1}`);
    },
    loadSnapshot: (trialId, snapshotId) => {
      const before = store.getState().trials.find((w) => w.id === trialId);
      store.getState().loadSnapshot(snapshotId, trialId);
      const after = store.getState().trials.find((w) => w.id === trialId);
      const position = store.getState().savedSnapshots.find((s) => s.id === snapshotId)?.clock;
      const handle = ownClock(trialId);
      if (after === before) return;
      holds.get(trialId)?.release();
      holds.delete(trialId);
      if (position && handle) holds.set(trialId, holdElapsed(handle, position));
    },
  };
}

/** The load holds `snapshotCommands` keeps, each released and dropped once
 *  its trial leaves `store`, and all of them on unmount. */
export function useLoadHolds(store: LabStore): Map<string, PlayheadHold> {
  const [holds] = useState(() => new Map<string, PlayheadHold>());
  useEffect(() => {
    const off = store.subscribe(() => {
      if (holds.size > 0) pruneLoadHolds(holds, new Set(store.getState().trials.map((w) => w.id)));
    });
    return () => {
      off();
      pruneLoadHolds(holds, new Set());
    };
  }, [store, holds]);
  return holds;
}

function pruneLoadHolds(holds: Map<string, PlayheadHold>, live: ReadonlySet<string>): void {
  for (const [id, hold] of holds) {
    if (live.has(id)) continue;
    hold.release();
    holds.delete(id);
  }
}
