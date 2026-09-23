import { useEffect, useMemo, useRef } from 'react';
import { useActionsRegistry } from './ActionsProvider';
import type { ActionsRegistry, UiOngoingControl } from './registry';

/**
 * One UI control's hold on an ongoing action — the handle a color picker, a
 * slider or a swatch drives the action through, the way a drag drives one
 * through a gesture.
 *
 * - `input(params)` opens the action on the first call and moves it on every
 *   later one: the live preview.
 * - `commit(params?)` moves it to `params`, if given, and ends it as one
 *   undoable edit. With nothing open, a commit carrying params is a whole edit
 *   on its own — a click on a swatch, a switch of paint kind.
 * - `cancel()` ends an open edit without keeping it.
 *
 * All three are no-ops when no action is reachable, so a control renders the
 * same with or without a canvas in scope.
 */
export interface OngoingAction {
  input(params: Record<string, unknown>): void;
  commit(params?: Record<string, unknown>): void;
  cancel(): void;
}

/**
 * Drive the ongoing action `actionId` from a UI control: {@link OngoingAction}.
 *
 * An edit left open when the control unmounts, or when `actionId` changes, is
 * committed — it is what the user was looking at when the control went away.
 * The returned object is stable for the life of the component.
 */
export function useOngoingAction(actionId: string): OngoingAction {
  const reg = useActionsRegistry();
  const regRef = useRef<ActionsRegistry | null>(reg);
  regRef.current = reg;
  const idRef = useRef(actionId);
  idRef.current = actionId;
  const ctrlRef = useRef<UiOngoingControl | null>(null);

  const edit = useMemo<OngoingAction>(() => {
    const end = (reason: 'commit' | 'cancel'): void => {
      const ctrl = ctrlRef.current;
      ctrlRef.current = null;
      ctrl?.end(reason);
    };
    return {
      input(params) {
        if (ctrlRef.current) ctrlRef.current.update(params);
        else ctrlRef.current = regRef.current?.begin(idRef.current, params) ?? null;
      },
      commit(params) {
        if (params !== undefined) {
          if (ctrlRef.current) ctrlRef.current.update(params);
          else ctrlRef.current = regRef.current?.begin(idRef.current, params) ?? null;
        }
        end('commit');
      },
      cancel() {
        end('cancel');
      },
    };
  }, []);

  useEffect(() => () => edit.commit(), [edit, actionId]);

  return edit;
}
