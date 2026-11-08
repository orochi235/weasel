import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';

/** A trial's settings: what a settings change writes. */
export interface TrialSettings {
  config: unknown;
  auto: readonly string[] | undefined;
}

/** What a trial's undo steps over: its state and its settings, together, since
 *  an instrument's `onConfigChange` derives one from the other. */
export interface TrialEdit extends TrialSettings {
  state: unknown;
}

export function readTrialSettings(record: TrialRecord): TrialSettings {
  return { config: record.config, auto: record.auto };
}

export function readTrialEdit(record: TrialRecord): TrialEdit {
  return { ...readTrialSettings(record), state: record.state };
}

/** Write a trial's settings back, and its state too when `edit` carries one. */
export function writeTrialEdit(
  store: LabStore,
  trialId: string,
  edit: TrialSettings | TrialEdit,
): void {
  store.setState((s) => ({
    trials: s.trials.map((t) => {
      if (t.id !== trialId) return t;
      const { auto: _was, ...kept } = t;
      const next: TrialRecord = { ...kept, config: edit.config };
      if ('state' in edit) next.state = edit.state;
      if (edit.auto && edit.auto.length > 0) next.auto = edit.auto;
      return next;
    }),
  }));
}
