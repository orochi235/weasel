import type { History } from '@weasel-js/core';
import type { UndoBindings } from './TrialChrome';
import type { TrialHistorySource } from './trialHistory';

interface MarkHistory {
  /** Whether the marks have a step to take each way. */
  moves: { undo: boolean; redo: boolean };
  undo: () => boolean;
  redo: () => boolean;
}

/**
 * What the trial's Undo and Redo step. Marks go first when the instrument
 * annotates — the most recent thing the user did is what undo is for, and only
 * a mark change moves the mark history. Then a history the instrument mounted
 * with `useTrialHistory`, and failing one, the trial's snapshots of `state`.
 * Undefined when the instrument declares neither `undo` nor `annotations`.
 */
export function trialUndoBindings(args: {
  declaresUndo: boolean;
  marks: MarkHistory | null;
  own: TrialHistorySource | null;
  snapshots: History | undefined;
}): UndoBindings | undefined {
  const { declaresUndo, marks, own, snapshots } = args;
  if (!declaresUndo && !marks) return undefined;
  const steps = declaresUndo ? (own ?? snapshots) : undefined;
  return {
    canUndo: (marks?.moves.undo ?? false) || (steps?.canUndo() ?? false),
    canRedo: (marks?.moves.redo ?? false) || (steps?.canRedo() ?? false),
    undo: () => {
      if (marks?.undo()) return;
      steps?.undo();
    },
    redo: () => {
      if (marks?.redo()) return;
      steps?.redo();
    },
  };
}
