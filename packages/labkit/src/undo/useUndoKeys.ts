import { historyKey, useLatest } from '@weasel-js/core';
import { useEffect } from 'react';
import { editsText } from '../trial/editsText';
import type { TrialHistorySource } from '../trial/trialHistory';

/** What {@link useUndoKeys} steps. */
export type UndoKeysTarget = Pick<TrialHistorySource, 'canUndo' | 'canRedo' | 'undo' | 'redo'>;

/**
 * The history step a keydown asks a page-level handler for: Mod+Z undoes,
 * Shift+Mod+Z and Mod+Y redo. Null for any other key, one already handled, and
 * one where the user types text, whose own undo is what they are asking for. A
 * slider or a checkbox is not text, so the chord still reaches the page there.
 */
export function undoKeyStep(e: KeyboardEvent): 'undo' | 'redo' | null {
  if (e.defaultPrevented) return null;
  const step = historyKey(e);
  return step && !editsText(e.target) ? step : null;
}

/**
 * Binds the undo chords on the document to `history`, as a trial binds them to
 * its own: for a lab laid out without `<Lab>`, which has no trial to do it.
 * A chord with nothing to step is left to the browser. `null` binds nothing.
 */
export function useUndoKeys(history: UndoKeysTarget | null): void {
  const latest = useLatest(history);
  const bound = history !== null;
  useEffect(() => {
    if (!bound) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = latest.current;
      const step = undoKeyStep(e);
      if (!target || !step) return;
      if (step === 'undo' ? !target.canUndo() : !target.canRedo()) return;
      e.preventDefault();
      if (step === 'undo') target.undo();
      else target.redo();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [bound, latest]);
}
