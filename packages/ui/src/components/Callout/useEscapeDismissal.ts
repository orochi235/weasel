import { useCallback, useContext, useMemo, useRef } from 'react';
import { useLatest } from '@weasel-js/core';
import { OverlayTriggerStateContext } from 'react-aria-components';

/** Reports a callout closed by Escape through `onDismiss`, and hands back the pieces `Callout` wires in. */
export function useEscapeDismissal(onDismiss: (() => void) | undefined) {
  // An Escape that closes the callout is a dismissal like the close button is.
  // The key alone is not the signal: RAC's overlay stack leaves the callout up
  // when a menu inside it is open. So the listener marks the event, and the
  // close RAC makes while that event is still being dispatched reports it.
  // It can't ride on a React `onKeyDown`: RAC's Dialog runs its props through
  // filterDOMProps, which drops handlers it doesn't know.
  const onDismissRef = useLatest(onDismiss);
  const escaping = useRef(false);
  const escapeListener = useRef((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    escaping.current = true;
    setTimeout(() => {
      escaping.current = false;
    }, 0);
  });
  const closedByEscape = useCallback(() => {
    if (!escaping.current) return;
    escaping.current = false;
    onDismissRef.current?.();
  }, [onDismissRef]);
  // Under `CalloutTrigger` the popover closes through the trigger's state and
  // never calls its own `onOpenChange`, so the report rides on that state.
  const trigger = useContext(OverlayTriggerStateContext);
  const watched = useMemo(
    () =>
      trigger && {
        ...trigger,
        close: () => {
          closedByEscape();
          trigger.close();
        },
      },
    [trigger, closedByEscape],
  );
  const listeningTo = useRef<HTMLElement | null>(null);
  const dialogRef = useCallback((node: HTMLElement | null) => {
    listeningTo.current?.removeEventListener('keydown', escapeListener.current);
    listeningTo.current = node;
    node?.addEventListener('keydown', escapeListener.current);
  }, []);
  return { watched, closedByEscape, dialogRef };
}
