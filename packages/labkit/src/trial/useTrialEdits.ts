import { useStore } from 'zustand/react';
import type { ResolvedConfig } from '../config/types';
import type { Instrument } from '../instrument/types';
import { undoCapability } from '../instrument/undo';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { useHistoryVersion, useMountedHistory } from './trialHistory';
import { useTrialMarks } from './useTrialMarks';
import { useTrialUndo } from './useTrialUndo';
import { useTrialWrites } from './useTrialWrites';

/** What a trial's edits are made against. */
export interface TrialEditSources {
  store: LabStore;
  record: TrialRecord;
  instrument: Instrument;
  schema: ResolvedConfig;
  config: unknown;
  /** The marks an instrument's own `AnnotationStorage` loaded. */
  keptMarks: unknown;
  /** The instrument's annotations while the lab shows marks, or undefined. */
  shownMarks: Instrument['annotations'];
}

/**
 * A trial's edits and their undo: the history its instrument mounts, its marks, the writes that snapshot it (`writes`
 * and `snapshot`, which takes a snapshot when the instrument asks for one on an event), and the Undo and Redo over
 * all of them.
 */
export function useTrialEdits({
  store,
  record,
  instrument,
  schema,
  config,
  keptMarks,
  shownMarks,
}: TrialEditSources) {
  const updateTrialAnnotations = useStore(store, (s) => s.updateTrialAnnotations);
  const mounted = useMountedHistory();
  const { annotations, provided, moves } = useTrialMarks({
    record,
    config,
    capability: instrument.annotations,
    keptMarks,
    save: updateTrialAnnotations,
  });
  const { snapshot, ...writes } = useTrialWrites({
    store,
    trialId: record.id,
    instrument,
    schema,
    mounted,
    marks: shownMarks ? annotations : null,
  });

  // Marks are undone through weasel history, not through labkit's snapshot
  // stack — the spec's rule, and the reason a mark scene is the truth.
  const snapshots = useHistoryVersion(record.history);
  const undoBindings = useTrialUndo({
    declaresUndo: undoCapability(instrument) != null,
    marks: shownMarks ? { moves, store: annotations } : null,
    own: mounted.history,
    snapshots,
  });
  return { mounted, annotations, provided, snapshot, writes, undoBindings };
}
