import type { Op } from '@weasel-js/core';
import type { LabStore } from '../state/store';
import {
  readTrialEdit,
  readTrialSettings,
  type TrialEdit,
  type TrialSettings,
  writeTrialEdit,
} from './trialEdit';

/** The name a trial's own undo entries go by in a saved history. */
export const TRIAL_EDIT_OP = 'labkit:trialEdit';

/** A trial edit entry's args: plain data, so the entry survives a reload. */
export interface TrialEditArgs {
  /** `'settings'` steps the trial's config and auto paths; `'edit'`, its state with them. */
  fields: 'settings' | 'edit';
  before: TrialSettings | TrialEdit;
  /** What to redo to: read in each time the entry is undone. */
  after?: TrialSettings | TrialEdit;
}

/**
 * An undo entry over trial `trialId`'s settings, or its settings and state. It
 * holds them as they stood `before`, and catches what to redo to each time it
 * is undone, since a snapshot is taken when an undoable event fires, before
 * the change it announces has necessarily landed. It writes to the store
 * itself rather than through an adapter, because a trial records these onto
 * an instrument's history too, whose adapter is its own.
 */
export function trialEditOp(args: TrialEditArgs, store: LabStore, trialId: string): Op {
  const read = (): TrialSettings | TrialEdit | undefined => {
    const record = store.getState().trials.find((t) => t.id === trialId);
    if (!record) return undefined;
    return args.fields === 'edit' ? readTrialEdit(record) : readTrialSettings(record);
  };
  const write = (value: TrialSettings | TrialEdit): void =>
    writeTrialEdit(store, trialId, structuredClone(value));
  const forward: Op = {
    name: TRIAL_EDIT_OP,
    args,
    label: 'state',
    apply: () => {
      if (args.after !== undefined) write(args.after);
    },
    invert: () => {
      const now = read();
      if (now) args.after = structuredClone(now);
      return { label: 'state', apply: () => write(args.before), invert: () => forward };
    },
  };
  return forward;
}

/** A trial edit entry over `record` as it stands now, ready to record. */
export function trialEditOf(
  record: Parameters<typeof readTrialEdit>[0],
  fields: TrialEditArgs['fields'],
  store: LabStore,
): Op {
  const before = fields === 'edit' ? readTrialEdit(record) : readTrialSettings(record);
  return trialEditOp({ fields, before: structuredClone(before) }, store, record.id);
}
