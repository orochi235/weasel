import { type ClockRegistry, clockPosition, holdAt, type PlayheadHold } from '@weasel-js/clock';
import { declaredClock, shownAt } from '../clock/trialClock';
import type { InstrumentList } from '../instrument/types';
import type { LabStore } from '../state/store';
import type { LabCommands } from './LabContext';

/**
 * A lab's snapshot save and load, which also carry a trial's own clock: a save
 * records where the clock stands now, and a load holds it at the saved time.
 * `holds` keeps each trial's load hold, released by the next load.
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
        current.updateTrialClock(trialId, clockPosition(handle.clock, spec?.duration, spec?.origin));
      }
      store.getState().saveSnapshot(trialId, name ?? `Snapshot ${taken + 1}`);
    },
    loadSnapshot: (trialId, snapshotId) => {
      const before = store.getState().trials.find((w) => w.id === trialId);
      store.getState().loadSnapshot(snapshotId, trialId);
      const after = store.getState().trials.find((w) => w.id === trialId);
      const position = store.getState().savedSnapshots.find((s) => s.id === snapshotId)?.clock;
      const handle = ownClock(trialId);
      if (after === before || !position || !handle) return;
      holds.get(trialId)?.release();
      holds.set(trialId, holdAt(handle, shownAt(position, handle.clock.origin)));
    },
  };
}
