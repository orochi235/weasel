import {
  type Action,
  ActionDisabledReason,
  type BoundGesture,
  useLatest,
  usePageActions,
} from '@weasel-js/core';
import { useMemo } from 'react';
import type { TrialHistorySource } from '../trial/trialHistory';

/** The undo and redo chords, as a tooltip shows them. */
export const UNDO_SHORTCUT = { key: 'z', mod: true } as const;
export const REDO_SHORTCUT = { key: 'z', mod: true, shift: true } as const;

const modKey = (key: string, shift = false): BoundGesture => ({
  spec: { kind: 'key', key, mods: shift ? { mod: true, shift: true } : { mod: true } },
});

/** The bindings that step a lab's history: Mod+Z back, Shift+Mod+Z or Mod+Y forward. */
export const UNDO_BINDINGS: readonly BoundGesture[] = [modKey('z')];
export const REDO_BINDINGS: readonly BoundGesture[] = [modKey('z', true), modKey('y')];

/** What {@link useUndoKeys} steps. */
export type UndoKeysTarget = Pick<TrialHistorySource, 'canUndo' | 'canRedo' | 'undo' | 'redo'>;

/**
 * Binds the undo chords on the page to `history`, as a trial binds them to
 * its own: for a lab laid out without `<Lab>`, which has no trial to do it.
 * A chord with nothing to step is left to the rest of the page. `null` binds nothing.
 */
export function useUndoKeys(history: UndoKeysTarget | null): void {
  const latest = useLatest(history);
  const actions = useMemo(() => undoActions(latest), [latest]);
  usePageActions(actions, history !== null);
}

/** Undo and redo over whatever `history` holds as each key lands. */
function undoActions(history: { readonly current: UndoKeysTarget | null }): readonly Action[] {
  const can = (step: 'undo' | 'redo') => () =>
    (step === 'undo' ? history.current?.canUndo() : history.current?.canRedo())
      ? true
      : ActionDisabledReason.NotApplicable;
  return [
    {
      id: 'lab.undo',
      label: 'Undo',
      defaultBinding: [...UNDO_BINDINGS],
      enabled: can('undo'),
      invoker: {
        timing: 'immediate',
        run: () => {
          history.current?.undo();
        },
      },
    },
    {
      id: 'lab.redo',
      label: 'Redo',
      defaultBinding: [...REDO_BINDINGS],
      enabled: can('redo'),
      invoker: {
        timing: 'immediate',
        run: () => {
          history.current?.redo();
        },
      },
    },
  ];
}
