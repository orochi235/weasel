import type { TrialEdit } from './trialEdit';

/** A config write within this long of the last one to the same path belongs
 *  to the same gesture — a control with no drafts writes on every move. */
export const GESTURE_MS = 500;

/** The gesture a trial's last config write began or continued. `start` is the record as the gesture found it, where
 *  its step is the trial's own snapshot, which a gesture ending where it started can take back. `open` while drafts
 *  run, which no pause ends. `version` stamps the trial's histories and marks when it was written. */
export interface WriteGesture {
  path: string;
  at: number;
  version: string;
  start: TrialEdit | null;
  open: boolean;
}

/** `last` after a write to `path`: a settled write ends the drafts that ran there before it. */
export function settledGesture(
  last: WriteGesture | null,
  path: string,
  draft: boolean,
): WriteGesture | null {
  return !draft && last?.open && last.path === path ? null : last;
}
