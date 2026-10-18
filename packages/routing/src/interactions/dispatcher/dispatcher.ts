/**
 * Dispatcher orchestrator — pure module, no React, no DOM.
 *
 * ## Precedence and fall-through
 * An exclusive affordance claim first bars every binding that does not
 * consult the affordance. The rest are ranked, best first, by:
 *   1. bindings naming the routed view ahead of every other
 *      (`preferViewScoped`);
 *   2. scope tier: hotkey > active > ambient;
 *   3. specificity within a tier (`specificity()` in `matcher.ts`);
 *   4. an action gated by an `eligible` rule that holds now ahead of one with
 *      no rule (`preferContextual`) — Escape while editing a path exits the
 *      edit rather than resetting the tool;
 *   5. registration order.
 * Candidates whose `eligible` rule is false are dropped first. The dispatcher
 * walks the rest and fires the first action whose `enabled()` returns
 * `true`. If every candidate's `enabled()` returns a disabled reason, the
 * event is unhandled.
 *
 * ## Action-lookup miss behavior
 * When the walk reaches a binding whose `actionId` has no entry in
 * `ctx.actions.list()`, the dispatcher emits `console.warn` and returns
 * `'unhandled'`, so the gesture falls through as if unmatched.
 */

import { createEmitter } from '@weasel-js/registry';
import type { Action } from '../actions/action';
import type { InputEvent } from './matcher';
import { buildDispatchRecord } from './buildDispatchRecord';
import { createGestureFacts } from './gestureFacts';
import { endAllGestures, invokeAction, pumpGesture, type GestureRun } from './gestureRun';
import { createInFlightGestures } from './inFlightGestures';
import { createUiOngoing } from './uiOngoing';
import { explain, resolveAll, resolveOnly } from './predict';
import { rank, walk, type Attempt } from './walk';

import type { Dispatcher, DispatcherContext } from './dispatcherApi';

export type {
  Dispatcher, DispatcherContext, ResolveAllOptions, ResolveOnlyResult, ResolvedCandidate, UiOngoingControl,
} from './dispatcherApi';
export { createDispatchTrace, createTraceRing } from './dispatchTrace';
export type { DispatchTrace, ModeSwitchLogEntry, TraceLogEntry, TraceRing } from './dispatchTrace';
export { multiTouchGestureId, pointerGestureId } from './gestureIds';
export { filterEligible, preferContextual } from './ranking';

/** Build a dispatcher. `getAction` overrides how action ids are resolved;
 *  by default the `DispatcherContext`'s registry is used. */
export function createDispatcher(opts?: {
  getAction?: (id: string) => Action | undefined;
}): Dispatcher {
  const inFlight = createInFlightGestures();
  const facts = createGestureFacts();

  /** Subscribers fired after every state mutation. Layers that read from
   *  `getInFlightHandles()` use this to know when to re-render. */
  const changed = createEmitter();
  /** Bumped before the callbacks run, so a subscriber that re-reads
   *  `getVersion()` synchronously inside its callback already sees the new
   *  value (what `useSyncExternalStore` does). */
  let version = 0;
  function notify(): void {
    version++;
    changed.emit();
  }

  const uiOngoing = createUiOngoing(inFlight, notify, opts?.getAction);

  // The view the input being handled landed in. Set per `handleInput`, so a
  // pump of an in-flight gesture reports the view it is pinned to.
  let routedView: string | null | undefined;
  let routedIsMac = false;

  const run: GestureRun = { inFlight, facts, viewId: () => routedView, isMac: () => routedIsMac };
  const invoking = (event: InputEvent): Attempt =>
    (match, action, deps) => invokeAction(run, event, match, action, deps);

  function handleInput(event: InputEvent, ctx: DispatcherContext): 'handled' | 'unhandled' {
    routedView = ctx.viewId;
    routedIsMac = ctx.isMac;
    const pumped = pumpGesture(run, event);
    if (pumped !== undefined) return pumped;

    if (event.kind === 'hover') return hover(event, ctx);

    const trace = ctx.trace?.recording() ? ctx.trace : null;
    const r = rank(event, ctx, inFlight.engagedOwners(), trace !== null);
    const walked = walk(r, event, ctx, invoking(event), false);
    const outcome: 'handled' | 'unhandled' = walked.stop === 'fired' ? 'handled' : 'unhandled';
    trace?.push(buildDispatchRecord(r, walked, event, ctx, false, outcome));
    return outcome;
  }

  /** A hover claims nothing, so the walk goes on past each binding it fires.
   *  Untraced: one arrives per mouse event. */
  function hover(event: InputEvent, ctx: DispatcherContext): 'handled' | 'unhandled' {
    let fired = false;
    const invoke = invoking(event);
    walk(rank(event, ctx, inFlight.engagedOwners(), false), event, ctx, (match, action, deps) => {
      if (invoke(match, action, deps) === 'fired') fired = true;
      return 'empty-handle';
    }, false);
    return fired ? 'handled' : 'unhandled';
  }

  function cancelAll(reason: 'commit' | 'cancel'): void {
    uiOngoing.clear();
    endAllGestures(run, reason);
  }

  // Wrap handleInput + cancelAll to notify once per invocation that found or
  // left a gesture in flight. Done at the boundary (not inside the match
  // loop) so a start, a pump, and an end each fire exactly one notify. An
  // event with nothing in flight on either side changed nothing a subscriber
  // reads, and hover sends one per mouse move.
  const handleInputWithNotify: typeof handleInput = (event, ctx) => {
    const before = inFlight.handles.size;
    try {
      return handleInput(event, ctx);
    } finally {
      if (before > 0 || inFlight.handles.size > 0) notify();
    }
  };
  const cancelAllWithNotify: typeof cancelAll = (reason) => {
    const before = inFlight.handles.size;
    try {
      cancelAll(reason);
    } finally {
      if (before > 0) notify();
    }
  };

  return {
    handleInput: handleInputWithNotify,
    resolveOnly: (event, ctx) => resolveOnly(event, ctx, inFlight.engagedOwners()),
    resolveAll: (event, ctx, resolveOpts) => resolveAll(event, ctx, inFlight.engagedOwners(), resolveOpts),
    explain: (event, ctx, explainOpts) => explain(event, ctx, inFlight.engagedOwners(), explainOpts),
    cancelAll: cancelAllWithNotify,
    inFlight: () => inFlight.handles,
    inFlightCursor: inFlight.cursor,
    getInFlightHandles: () => inFlight.handles.values(),
    subscribe: changed.subscribe,
    getVersion: () => version,
    getActiveAction: inFlight.latest,
    beginUiOngoing: uiOngoing.begin,
  };
}
