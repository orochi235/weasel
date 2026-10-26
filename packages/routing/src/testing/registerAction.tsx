import type { Action } from '../interactions/actions/action';
import { useAction } from '../interactions/actions/ActionsProvider';

/** Registers `action` with the enclosing `<ActionsProvider>` while mounted, and renders nothing. */
export function RegisterAction({ action }: { action: Action }): null {
  useAction(action);
  return null;
}

/** A {@link RegisterAction} for each of `actions`. */
export function RegisterActions({ actions }: { actions: readonly Action[] }) {
  return (
    <>
      {actions.map((a) => <RegisterAction key={a.id} action={a} />)}
    </>
  );
}
