import { createContext, use, useContext } from 'react';
import type { ConfigRule, ControlRenderer } from '../config/types';
import type { InstrumentList } from '../instrument/types';
import type { LabMode, SavedSnapshot, TrialRecord } from '../state/types';
import type { AddTrialOptions } from '../trial/trialOps';

/** Lab-wide state and commands: the available instruments, the open
 *  trials and the operations over them, saved snapshots, and the color
 *  mode. */
export interface LabContextValue {
  instruments: InstrumentList;
  trials: TrialRecord[];
  /** Open a trial running `instrumentName`. `options.config` is written over
   *  that instrument's defaults, which is where a trial opened on a subject
   *  says which subject. */
  addTrial: (instrumentName: string, options?: AddTrialOptions) => void;
  cloneTrial: (id: string) => void;
  closeTrial: (id: string) => void;
  resetTrial: (id: string) => void;
  reorderTrials: (ids: readonly string[]) => void;
  /** Put a fresh trial running `instrumentName` in trial `id`'s place, at its
   *  size. The replacement has a new id, and takes the focus if `id` had it. */
  swapTrial: (id: string, instrumentName: string, options?: AddTrialOptions) => void;
  /** The trial last pointed at or focused, counting focus that moved into a
   *  frame inside it. A trial `addTrial` or `cloneTrial` opens takes it. Falls
   *  back to the first trial; null only when there are none. */
  focusedTrialId: string | null;
  focusTrial: (id: string) => void;
  savedSnapshots: SavedSnapshot[];
  saveSnapshot: (trialId: string, name?: string) => void;
  loadSnapshot: (trialId: string, snapshotId: string) => void;
  deleteSnapshot: (snapshotId: string) => void;
  mode: LabMode;
  setMode: (m: LabMode) => void;
  /** Whether the lab shows marks: its annotation targets' overlays, each
   *  trial's Marks section and export, and the drawing tools in its rail. The
   *  marks themselves are kept either way. */
  marks: boolean;
  setMarks: (shown: boolean) => void;
  /** Lab-wide rules run over every instrument's config leaves, before
   *  labkit's own inference. */
  configRules?: readonly ConfigRule[];
  /** Lab-wide control overrides, keyed by config path or by leaf kind. */
  controls?: Record<string, ControlRenderer>;
}

/** Context carrying the surrounding lab. Prefer `useLabContext`. */
export const LabContext = createContext<LabContextValue | null>(null);

/** A lab without its `trials`: its commands, and what changes far less often
 *  than a trial's record does. */
export type LabCommands = Omit<LabContextValue, 'trials'>;

/** Context carrying {@link LabCommands}. Prefer `useLabCommands`. */
export const LabCommandsContext = createContext<LabCommands | null>(null);

/** The surrounding lab's commands, or null outside one. Under a bare
 *  `LabContext.Provider` it reads that, and re-renders with it. */
export function useLabCommandsOptional(): LabCommands | null {
  return use(LabCommandsContext) ?? use(LabContext);
}

/**
 * The surrounding lab without its `trials`, for a component that must not
 * re-render each time any trial's record changes — a pan frame, a job item,
 * a clock write. Read a trial through the store instead. Throws outside a
 * `<Lab>`.
 */
export function useLabCommands(): LabCommands {
  const ctx = useLabCommandsOptional();
  if (ctx === null) {
    throw new Error('useLabCommands must be used inside <Lab>');
  }
  return ctx;
}

/** The surrounding lab. Throws outside a `<Lab>`. */
export function useLabContext(): LabContextValue {
  const ctx = useContext(LabContext);
  if (ctx === null) {
    throw new Error('useLabContext must be used inside <Lab>');
  }
  return ctx;
}

/** The ids of a lab's trials, in order: a selector for a reader that must not re-render when a record changes. */
export const trialIdsOf = (s: { trials: readonly { id: string }[] }): string[] =>
  s.trials.map((t) => t.id);
