/**
 * Ongoing handles a UI control drives instead of a gesture: a slider scrubbing
 * a value opens one, updates it, and ends it. They sit in flight beside the
 * gestures', so an overlay or a cancel-all treats both alike.
 */
import type { Action } from '../actions/action';
import type { ActionDeps, OngoingHandle } from '../actions/invoker';
import type { UiOngoingControl } from './dispatcherApi';
import { isEmptyOngoingHandle, type InFlightGestures } from './inFlightGestures';
import { uiInvocationCtx } from './invocationCtx';

export interface UiOngoing {
  begin(actionId: string, deps: ActionDeps, params?: Record<string, unknown>): UiOngoingControl | null;
  /** Forget which action each handle belongs to, once every handle has been taken out of flight. */
  clear(): void;
}

export function createUiOngoing(
  inFlight: InFlightGestures,
  notify: () => void,
  getAction: ((id: string) => Action | undefined) | undefined,
): UiOngoing {
  let seq = 0;
  /** actionId → gestureId of that action's handle in flight, so a second
   *  `begin` for the action commits the first. */
  const byAction = new Map<string, string>();

  function commitPrior(actionId: string, deps: ActionDeps): void {
    const prevGestureId = byAction.get(actionId);
    if (prevGestureId === undefined) return;
    const prevHandle = inFlight.handles.get(prevGestureId);
    if (prevHandle?.onEnd) {
      try { prevHandle.onEnd(uiInvocationCtx(deps), 'commit'); }
      catch (e) { console.error(`weasel dispatcher: prior UI handle for "${actionId}" threw on auto-commit`, e); }
    }
    inFlight.take(prevGestureId);
    byAction.delete(actionId);
  }

  function control(actionId: string, gestureId: string, handle: OngoingHandle, deps: ActionDeps): UiOngoingControl {
    let ended = false;
    // The dispatcher can end this handle without the control knowing —
    // `cancelAll` on tool switch, Escape, or unmount. Absence from the
    // in-flight handles is that signal; without it a later `end()` would
    // run `onEnd` a second time and commit over an already-canceled gesture.
    const live = (): boolean => !ended && inFlight.handles.get(gestureId) === handle;
    return {
      gestureId,
      get active() { return live(); },
      update(nextParams) {
        if (!live()) return;
        if (!handle.onMove) return;
        try { handle.onMove(uiInvocationCtx(deps, nextParams)); }
        catch (e) { console.error(`weasel dispatcher: action "${actionId}" threw on onMove`, e); }
        notify();
      },
      end(reason) {
        if (!live()) { ended = true; return; }
        ended = true;
        if (handle.onEnd) {
          try { handle.onEnd(uiInvocationCtx(deps), reason); }
          catch (e) { console.error(`weasel dispatcher: action "${actionId}" threw on onEnd`, e); }
        }
        inFlight.take(gestureId);
        if (byAction.get(actionId) === gestureId) byAction.delete(actionId);
        notify();
      },
    };
  }

  return {
    begin(actionId, deps, params) {
      if (!getAction) {
        console.warn('weasel dispatcher: beginUiOngoing called but no getAction was provided to createDispatcher');
        return null;
      }
      const action = getAction(actionId);
      if (!action || !action.invoker || action.invoker.timing !== 'ongoing') {
        return null;
      }
      commitPrior(actionId, deps);

      const gestureId = `ui-${actionId}-${++seq}`;
      let handle: OngoingHandle;
      try {
        // Params go through both `ctx.params` (the UI-driven channel) and
        // `BindingOpts.params` (the gesture-driven channel).
        handle = action.invoker.start(uiInvocationCtx(deps, params), { params });
      } catch (e) {
        console.error(`weasel dispatcher: action "${actionId}" threw on start`, e);
        return null;
      }
      if (isEmptyOngoingHandle(handle)) return null;

      inFlight.open(gestureId, handle, null);
      byAction.set(actionId, gestureId);
      notify();
      return control(actionId, gestureId, handle, deps);
    },
    clear: () => { byAction.clear(); },
  };
}
