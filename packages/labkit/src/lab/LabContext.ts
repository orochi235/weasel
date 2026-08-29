import { createContext, useContext } from 'react';
import type { ConfigRule, ControlRenderer } from '../config/types';
import type { InstrumentList } from '../instrument/types';
import type { LabMode, SavedSnapshot, TrialRecord } from '../state/types';

/** Lab-wide state and commands: the available instruments, the open
 *  trials and the operations over them, saved snapshots, and the color
 *  mode. */
export interface LabContextValue {
  instruments: InstrumentList;
  trials: TrialRecord[];
  addTrial: (instrumentName: string) => void;
  cloneTrial: (id: string) => void;
  closeTrial: (id: string) => void;
  resetTrial: (id: string) => void;
  reorderTrials: (ids: readonly string[]) => void;
  savedSnapshots: SavedSnapshot[];
  saveSnapshot: (trialId: string, name?: string) => void;
  loadSnapshot: (trialId: string, snapshotId: string) => void;
  deleteSnapshot: (snapshotId: string) => void;
  mode: LabMode;
  setMode: (m: LabMode) => void;
  /** Lab-wide rules run over every instrument's config leaves, before
   *  labkit's own inference. */
  configRules?: readonly ConfigRule[];
  /** Lab-wide control overrides, keyed by config path or by leaf kind. */
  controls?: Record<string, ControlRenderer>;
}

/** Context carrying the surrounding lab. Prefer `useLabContext`. */
export const LabContext = createContext<LabContextValue | null>(null);

/** The surrounding lab. Throws outside a `<Lab>`. */
export function useLabContext(): LabContextValue {
  const ctx = useContext(LabContext);
  if (ctx === null) {
    throw new Error('useLabContext must be used inside <Lab>');
  }
  return ctx;
}
