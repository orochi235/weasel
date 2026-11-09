import type { History } from '@weasel-js/core';
import type { AnnotationsApi } from '../annotations/types';
import type { UndoBindings } from './TrialChrome';
import type { TrialHistorySource } from './trialHistory';

interface MarkHistory {
  /** Whether the marks have a step to take each way. */
  moves: { undo: boolean; redo: boolean };
  store: Pick<AnnotationsApi, 'undo' | 'redo' | 'undoStamp' | 'redoStamp'>;
}

/** What steps a trial's state and settings, and when its next step each way was recorded. */
export interface Steps {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): unknown;
  redo(): unknown;
  undoStamp(): number | undefined;
  redoStamp(): number | undefined;
  dropRedo(): void;
  subscribe(listener: () => void): () => void;
}

const snapshotSteps = (h: History): Steps => ({
  canUndo: () => h.canUndo(),
  canRedo: () => h.canRedo(),
  undo: () => h.undo(),
  redo: () => h.redo(),
  undoStamp: () => h.timestampAt(h.undoDepth() - 1),
  redoStamp: () => h.timestampAt(h.undoDepth()),
  dropRedo: () => h.dropRedo(),
  subscribe: (listener) => h.subscribe(listener),
});

const ownSteps = (own: TrialHistorySource): Steps => ({
  canUndo: () => own.canUndo(),
  canRedo: () => own.canRedo(),
  undo: () => own.undo(),
  redo: () => own.redo(),
  undoStamp: () => own.undoStamp?.(),
  redoStamp: () => own.redoStamp?.(),
  dropRedo: () => own.dropRedo?.(),
  subscribe: (listener) => own.subscribe(listener),
});

/** What the trial steps beside its marks: the instrument's own history, else its snapshots of `state`. */
export function trialSteps(
  declaresUndo: boolean,
  own: TrialHistorySource | null,
  snapshots: History | undefined,
): Steps | undefined {
  if (!declaresUndo) return undefined;
  return own ? ownSteps(own) : snapshots && snapshotSteps(snapshots);
}

/**
 * What the trial's Undo and Redo step: the marks, when the instrument
 * annotates, and a history the instrument mounted with `useTrialHistory`, or
 * failing one, the trial's snapshots of `state`. Undo takes back whichever of
 * the marks and the other history recorded its step most recently, and Redo
 * makes again whichever step was made first. Where that history cannot say
 * when its steps were recorded (a `TrialHistorySource` without `undoStamp`
 * and `redoStamp`), the marks go first. Undefined when the instrument
 * declares neither `undo` nor `annotations`.
 */
export function trialUndoBindings(args: {
  declaresUndo: boolean;
  marks: MarkHistory | null;
  own: TrialHistorySource | null;
  snapshots: History | undefined;
}): UndoBindings | undefined {
  const { declaresUndo, marks, own, snapshots } = args;
  if (!declaresUndo && !marks) return undefined;
  const steps = trialSteps(declaresUndo, own, snapshots);
  /** Whether the marks take the next step `dir`, rather than `steps`. */
  const marksFirst = (dir: 'undo' | 'redo'): boolean => {
    if (!marks?.moves[dir]) return false;
    if (!(dir === 'undo' ? steps?.canUndo() : steps?.canRedo())) return true;
    const mark = dir === 'undo' ? marks.store.undoStamp() : marks.store.redoStamp();
    const step = dir === 'undo' ? steps?.undoStamp() : steps?.redoStamp();
    if (mark === undefined || step === undefined) return true;
    return dir === 'undo' ? mark > step : mark < step;
  };
  return {
    canUndo: (marks?.moves.undo ?? false) || (steps?.canUndo() ?? false),
    canRedo: (marks?.moves.redo ?? false) || (steps?.canRedo() ?? false),
    undo: () => {
      if (marksFirst('undo') && marks?.store.undo()) return;
      steps?.undo();
    },
    redo: () => {
      if (marksFirst('redo') && marks?.store.redo()) return;
      steps?.redo();
    },
  };
}
