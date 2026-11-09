import type { History } from '@weasel-js/core';
import { useEffect, useMemo, useRef } from 'react';
import type { AnnotationsApi } from '../annotations/types';
import type { UndoBindings } from './TrialChrome';
import type { TrialHistorySource } from './trialHistory';
import { type Steps, trialSteps, trialUndoBindings } from './trialUndo';

/** What a trial's Undo and Redo step (`trialUndoBindings`), with its two histories kept one order. */
export function useTrialUndo(args: {
  declaresUndo: boolean;
  marks: { moves: { undo: boolean; redo: boolean }; store: AnnotationsApi } | null;
  own: TrialHistorySource | null;
  snapshots: History | undefined;
}): UndoBindings | undefined {
  const { declaresUndo, marks, own, snapshots } = args;
  const steps = useMemo(
    () => trialSteps(declaresUndo, own, snapshots),
    [declaresUndo, own, snapshots],
  );
  useCrossRedo(marks?.store ?? null, steps);
  return trialUndoBindings(args);
}

type Marks = Pick<AnnotationsApi, 'subscribe' | 'undoStamp' | 'dropRedo'>;

/**
 * Keeps a trial's two undo histories one order: a new change on the marks
 * drops what `steps` could redo, and one on `steps` drops what the marks
 * could. A change is new when the step it leaves on top is stamped later than
 * any either side has shown; an undo or a redo only brings back older stamps.
 * A history that cannot stamp its steps is never seen changing, and one that
 * cannot drop its redo keeps it. `steps` should keep its identity across
 * renders; a new one is checked as it arrives, since the trial's snapshots
 * only exist once its first change has made them.
 */
function useCrossRedo(marks: Marks | null, steps: Steps | undefined): void {
  const high = useRef(Number.NEGATIVE_INFINITY);
  useEffect(() => {
    if (!marks || !steps) return;
    const check = (): void => {
      const mark = marks.undoStamp();
      const step = steps.undoStamp();
      const before = high.current;
      high.current = Math.max(before, mark ?? before, step ?? before);
      if (mark !== undefined && mark > before) steps.dropRedo();
      if (step !== undefined && step > before) marks.dropRedo();
    };
    const offMarks = marks.subscribe(check);
    const offSteps = steps.subscribe(check);
    check();
    return () => {
      offMarks();
      offSteps();
    };
  }, [marks, steps]);
}
