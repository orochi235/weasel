import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';

/** What a trial's undo steps over: its state and its settings, together, since
 *  an instrument's `onConfigChange` derives one from the other. */
export interface TrialEdit {
  state: unknown;
  config: unknown;
  auto: readonly string[] | undefined;
}

export function readTrialEdit(record: TrialRecord): TrialEdit {
  return { state: record.state, config: record.config, auto: record.auto };
}

export function writeTrialEdit(store: LabStore, trialId: string, edit: TrialEdit): void {
  store.setState((s) => ({
    trials: s.trials.map((t) => {
      if (t.id !== trialId) return t;
      const { auto: _was, ...kept } = t;
      const next: TrialRecord = { ...kept, state: edit.state, config: edit.config };
      if (edit.auto && edit.auto.length > 0) next.auto = edit.auto;
      return next;
    }),
  }));
}
