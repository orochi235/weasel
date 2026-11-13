import { undoKeyStep, useLatest } from '@weasel-js/core';
import { useEffect } from 'react';
import type { TrialHistorySource } from '../trial/trialHistory';

/** The undo and redo chords `undoKeyStep` answers to, as a tooltip shows them. */
export const UNDO_SHORTCUT = { key: 'z', mod: true } as const;
export const REDO_SHORTCUT = { key: 'z', mod: true, shift: true } as const;

/** What {@link useUndoKeys} steps. */
export type UndoKeysTarget = Pick<TrialHistorySource, 'canUndo' | 'canRedo' | 'undo' | 'redo'>;

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
