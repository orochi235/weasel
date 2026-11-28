/**
 * The view a multitouch gesture runs on: the one its fingers were routed to when it opened, though
 * its fingers may each be pinned to another.
 */
import type { DispatchCore } from '../dispatchCore';
import { multiTouchGestureId } from '../gestureIds';
import type { InputEvent } from '../matcher';

type Core = Pick<DispatchCore, 'dispatch' | 'dispatcherNow' | 'routedView' | 'setRoutedView'>;

export function touchView(core: Core) {
  /** The gesture's view, or `undefined` with none open. */
  let view: string | null | undefined;
  /** Whether the gesture has ended: only the tap that may follow its end still runs on its view. */
  let ended = false;
  /** Run `fn` routed to the gesture's view, if one is open. */
  const within = <T,>(fn: () => T): T => {
    if (view === undefined) return fn();
    const routed = core.routedView();
    core.setRoutedView(view);
    try { return fn(); } finally { core.setRoutedView(routed); }
  };
  return {
    within,
    dispatch(ev: InputEvent): 'handled' | 'unhandled' {
      if (ev.kind !== 'multitouch' && ev.kind !== 'multitouchtap') return core.dispatch(ev);
      const end = ev.kind === 'multitouch' && 'end' in ev && ev.end !== undefined;
      if (ev.kind === 'multitouch' && !end && (view === undefined || ended)) {
        view = core.routedView();
        ended = false;
      }
      const result = within(() => core.dispatch(ev));
      if (ev.kind === 'multitouchtap') view = undefined;
      else if (end && ev.fingers <= 2) ended = true;
      return result;
    },
    inFlight: (fingers: number): boolean => within(() => core.dispatcherNow().inFlight().has(multiTouchGestureId(fingers))),
  };
}
