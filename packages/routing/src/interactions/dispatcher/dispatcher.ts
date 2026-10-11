/**
 * Dispatcher orchestrator — pure module, no React, no DOM.
 *
 * Assembles `ScopedBinding[]` from the actions registry, active tool, and
 * hotkey stack; matches input events via `matchSorted`; gates each candidate
 * on `enabled()`; then invokes `immediate` or `ongoing` invokers and tracks
 * in-flight handles.
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
 * event is unhandled. This mirrors CSS-style specificity matching with a
 * `:not(:disabled)` filter, and lets a tool declare a high-specificity
 * binding (e.g. drag-on-empty → areaSelect) that gracefully falls through
 * to a lower-specificity ambient binding (e.g. drag → viewport.dragPan)
 * when its required deps aren't wired.
 *
 * ## gestureId scheme
 * - `key-held` ongoing actions: `key-held-<code>` (`key-held-Space`), so two
 *   keys that share a `key`, such as the two Shifts, hold separately. An event
 *   with no code keys by `key`.
 *   Chosen because key-held gestures are identified by the held key alone.
 * - `pointerdown` / drag ongoing actions: `pointer-<pointerId>`, taken from
 *   the originating DOM `PointerEvent`. Each physical pointer — mouse, each
 *   touch, the stylus — gets its own handle slot. Events with no
 *   `pointerId` (synthesized probes, programmatic drags, most tests) key to
 *   `pointer-mouse`, so a single synthetic pointer behaves as it always has.
 * - `multitouch` ongoing actions: `multitouch-<fingers>`.
 * - Fallback for any other kind that triggers an ongoing invoker: `ongoing-<kind>`.
 *
 * ## Action-lookup miss behavior
 * When the walk reaches a binding whose `actionId` has no entry in
 * `ctx.actions.list()`, the dispatcher emits `console.warn` and returns
 * `'unhandled'`. The user's input gesture falls through as if unmatched.
 * This preserves input flow (nothing is swallowed silently) while flagging
 * the misconfiguration at dev time.
 */


import type { Action, ActionSource } from '../actions/action';
import { actionBindings } from '../actions/binding';
import type { OngoingHandle, InvocationCtx, ActionDeps, AffordanceHit, DragSample, Point2 } from '../actions/invoker';
import { resolveParams } from '../actions/invoker';
import { buildDepsFromRequires } from '../actions/buildDeps';
import { assembleEntries, scopeBindings } from '../../contributions/assemble';
import type { InputEvent, BindingScope, MatchResult, ScopedBinding } from './matcher';
import { matchSortedWithBarred, specificity } from './matcher';
import type { DispatchRecord, WalkStep } from './dispatchRecord';
import { resolveCursor, type CursorSpec } from '@weasel-js/cursor';
import { buildDispatchRecord } from './buildDispatchRecord';
import { DEV, recordTrace } from './dispatchTrace';
import { modifiersOf, worldPointOf } from './inputFacts';
import {
  describeEligible, isEligible, liveInView, preferContextual, preferViewScoped, ruleCtxOf,
  type Ranking, type Walked,
} from './ranking';

import type { Dispatcher, DispatcherContext, ResolveAllOptions, ResolveOnlyResult, ResolvedCandidate, UiOngoingControl } from './dispatcherApi';

export type {
  Dispatcher, DispatcherContext, ResolveAllOptions, ResolveOnlyResult, ResolvedCandidate, UiOngoingControl,
} from './dispatcherApi';
export { publishLiveDispatch, recordModeSwitch } from './dispatchTrace';
export type { ModeSwitchLogEntry, TraceLogEntry } from './dispatchTrace';
export { filterEligible, preferContextual } from './ranking';

/**
 * The in-flight handle slot a pointer's gestures key into.
 *
 * Exported because the React seam (`useGestureDispatcher`) has to name the
 * same slot when it asks `dispatcher.inFlight()` whether a given pointer is
 * mid-drag. That used to be the string literal `'pointer-mouse'` on both
 * sides, which was correct only because `gestureIdFor` ignored the pointer id
 * entirely — the two lies cancelled out.
 *
 * @param pointerId - `PointerEvent.pointerId`, or `undefined` for a
 *   synthesized event with no originating DOM pointer.
 */
export function pointerGestureId(pointerId: number | undefined): string {
  return `pointer-${pointerId ?? 'mouse'}`;
}

// ---------------------------------------------------------------------------
// createDispatcher
// ---------------------------------------------------------------------------

const EMPTY_ENGAGED: ReadonlySet<string> = new Set();

/** Build a dispatcher. `getAction` overrides how action ids are resolved;
 *  by default the `DispatcherContext`'s registry is used. */
export function createDispatcher(opts?: {
  getAction?: (id: string) => Action | undefined;
}): Dispatcher {
  const inFlightHandles = new Map<string, OngoingHandle>();
  /** gestureId → tool id that owns the binding which opened this handle.
   *  Used to compute the `engagedChannels` PhaseContext for the matcher.
   *  `null` when the opening binding came from an ambient action with no
   *  owning tool. */
  const inFlightOwners = new Map<string, string | null>();
  /** Gesture id -> the Action whose handle is in flight, so the hover-cursor
   *  pump can ask what the gesture currently IS rather than what a drag from
   *  here WOULD be. See `Action.activeCursor`. */
  const inFlightActions = new Map<string, Action>();

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Per-gesture drag origin, keyed by gestureId.
   * Set when an ongoing drag handle is opened; used to compute deltas for
   * `pointermove` pump events.
   *
   * Stores both world (`x`/`y`) and client/screen (`clientX`/`clientY`)
   * coordinates so we can produce both `drag.delta` (world) and
   * `drag.screenDelta` (client). View-mutating drag actions (pan, etc.)
   * must consume `screenDelta` — world deltas are self-referential when
   * the action itself shifts the view.
   */
  const dragOrigins = new Map<string, { x: number; y: number; clientX?: number; clientY?: number }>();

  /** Subscribers fired after every state mutation. Layers that read from
   *  `getInFlightHandles()` use this to know when to re-render. */
  const subscribers = new Set<() => void>();
  /** Bumped before the callbacks run, so a subscriber that re-reads
   *  `getVersion()` synchronously inside its callback already sees the new
   *  value (what `useSyncExternalStore` does). */
  let version = 0;
  function notify(): void {
    version++;
    for (const fn of subscribers) fn();
  }

  /**
   * Per-gesture pointermove history (world-space points), keyed by gestureId.
   * Accumulated on every `pointermove` pump event. Passed as
   * `InvocationCtx.drag.points` so invokers that need the full path
   * (e.g. `lassoSelectAction`) can consume it.
   *
   * Samples carry the originating event's stylus fields (pressure / tilt)
   * when present, so pressure-aware invokers — `insertAction`'s pencil
   * kind — get per-sample data without their own pointer plumbing.
   */
  const dragPoints = new Map<string, DragSample[]>();

  /**
   * Pinch-zoom start spread, keyed by multitouch gestureId.
   * Captured when the multitouch ongoing handle first opens.
   */
  const pinchStartSpreads = new Map<string, number>();

  /** Monotonic counter for synthesizing unique gestureIds for UI-driven
   *  ongoing handles. Each `beginUiOngoing` call increments this. */
  let uiOngoingSeq = 0;

  /** actionId → gestureId of the currently in-flight UI-driven handle for
   *  that action, if any. Used to auto-commit a prior handle when a new
   *  `beginUiOngoing(sameActionId, …)` arrives. */
  const uiOngoingByAction = new Map<string, string>();

  /** Returns true when a handle carries no gesture-processing callbacks or
   *  preview data — i.e. the invoker decided at runtime not to engage. */
  function isEmptyOngoingHandle(h: OngoingHandle): boolean {
    return !h.onMove && !h.onEnd && !h.overlay && !h.previewIds && !h.previewPose;
  }

  // The view the input being handled landed in. Set per `handleInput`, so a
  // pump of an in-flight gesture reports the view it is pinned to.
  let routedView: string | null | undefined;

  /** Build a zero-position InvocationCtx for UI-driven invocations (no
   *  pointer event involved — world/screen coords are irrelevant). */
  function buildUiInvocationCtx(deps: ActionDeps, params?: Record<string, unknown>): InvocationCtx {
    return {
      world: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps,
      ...(params !== undefined ? { params } : {}),
    };
  }

  /** Build a minimal InvocationCtx stub for the given event + deps. */
  function buildInvocationCtx(event: InputEvent, deps: ActionDeps, gestureId?: string): InvocationCtx {
    const modifiers = {
      alt: event.altKey,
      ctrl: event.ctrlKey,
      meta: event.metaKey,
      shift: event.shiftKey,
    };
    const base: InvocationCtx = {
      world: { x: 0, y: 0 },
      modifiers,
      deps,
      ...(routedView !== undefined ? { viewId: routedView } : {}),
    };

    // The pointer in client pixels, where the event carries it. Not every kind
    // does, which is why `ctx.screen` is optional — filling it from the world
    // point instead is how it came to be screen-space in name only.
    const clientPoint = (ev: InputEvent): Point2 | undefined => {
      const cx = (ev as { clientX?: number }).clientX;
      const cy = (ev as { clientY?: number }).clientY;
      return cx !== undefined && cy !== undefined ? { x: cx, y: cy } : undefined;
    };
    const screen = clientPoint(event);
    if (screen) base.screen = screen;

    // Populate gesture-kind-specific fields.
    if (event.kind === 'key') {
      base.key = { key: event.key, repeat: event.repeat ?? false };
    } else if (event.kind === 'key-held') {
      base.key = { key: event.key, repeat: false };
    } else if (event.kind === 'wheel') {
      base.wheel = { deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: 0 };
    } else if (event.kind === 'pinch') {
      base.pinch = { scale: event.scale, rotation: event.rotation };
    } else if (
      event.kind === 'pointerdown'
      || event.kind === 'click'
      || event.kind === 'doubleclick'
      || event.kind === 'contextmenu'
    ) {
      // A click's own world point is `x`/`y` — the release — with the press
      // as the fallback for a consumer that wired neither.
      const sx = event.x ?? (event.kind === 'click' ? event.pressX : undefined) ?? 0;
      const sy = event.y ?? (event.kind === 'click' ? event.pressY : undefined) ?? 0;
      base.world = { x: sx, y: sy };
      const affordance = event.kind === 'pointerdown' ? (event.affordance as AffordanceHit | undefined) : undefined;
      base.drag = {
        start: { x: sx, y: sy },
        current: { x: sx, y: sy },
        delta: { x: 0, y: 0 },
        ...(affordance !== undefined ? { affordance } : {}),
      };
    } else if (event.kind === 'pointermove' || event.kind === 'pointerup') {
      const cx = event.x;
      const cy = event.y;
      base.world = { x: cx, y: cy };
      // Compute delta relative to drag origin if available.
      const origin = gestureId ? dragOrigins.get(gestureId) : undefined;
      const ox = origin?.x ?? cx;
      const oy = origin?.y ?? cy;
      // Live accumulator during the drag — copying it on every move would be
      // quadratic — but a snapshot on the last event, because `onEnd` is where
      // an action is entitled to keep the trail, and the dispatcher clears the
      // accumulator the moment it returns.
      const live = gestureId ? dragPoints.get(gestureId) : undefined;
      const points = live && event.kind === 'pointerup' ? [...live] : live;
      // Screen-space delta — populated when both the event and origin carry
      // client coords. View-mutating drag actions must read this rather than
      // the world `delta` (world deltas are self-referential mid-pan).
      const eventClientX = event.clientX;
      const eventClientY = event.clientY;
      const hasClient =
        eventClientX !== undefined && eventClientY !== undefined
        && origin?.clientX !== undefined && origin?.clientY !== undefined;
      base.drag = {
        start: { x: ox, y: oy },
        current: { x: cx, y: cy },
        delta: { x: cx - ox, y: cy - oy },
        ...(hasClient
          ? { screenDelta: { x: eventClientX! - origin!.clientX!, y: eventClientY! - origin!.clientY! } }
          : {}),
        ...(points !== undefined ? { points } : {}),
      };
    } else if (event.kind === 'multitouch') {
      const centroid = event.centroid ?? { x: 0, y: 0 };
      const spread = event.spread ?? 1;
      // Populate pinch geometry when this is a move-pump (centroid/spread present).
      const startSpread = gestureId ? pinchStartSpreads.get(gestureId) : undefined;
      base.multiTouch = {
        centroid,
        spread,
        rotation: 0,
        ...(startSpread !== undefined && event.spread !== undefined
          ? { pinch: { startSpread, currentSpread: spread, centroid } }
          : {}),
      };
    }

    return base;
  }

  /**
   * Derive a gestureId from an event for keying in-flight ongoing handles.
   * See module JSDoc for the full scheme.
   */
  function gestureIdFor(event: InputEvent): string {
    if (event.kind === 'key-held') {
      return `key-held-${event.code ?? event.key}`;
    }
    if (
      event.kind === 'pointerdown' ||
      event.kind === 'pointermove' ||
      event.kind === 'pointerup' ||
      event.kind === 'pointercancel'
    ) {
      return pointerGestureId(event.pointerId);
    }
    if (event.kind === 'multitouch') {
      return `multitouch-${event.fingers}`;
    }
    return `ongoing-${event.kind}`;
  }

  /** Assemble the ScopedBinding list: every registered entry, tiered by what
   *  it declares about its own eligibility, then the actions registry. */
  function assembleScopedBindings(ctx: DispatcherContext): ScopedBinding[] {
    // `allowedCapabilities` is absent for a consumer with no mode system, who
    // supplies no `getRuleCtx`, and then every entry is permitted.
    const allowedCapabilities = ctx.getRuleCtx?.()?.allowedCapabilities;
    const { ordered, state } = assembleEntries(ctx.entriesById.values(), {
      focusedId: ctx.activeToolId,
      hotkeyStack: ctx.hotkeyStack,
      ...(allowedCapabilities ? { allowedCapabilities } : {}),
    });
    const view = ctx.viewId ?? null;
    const result: ScopedBinding[] = scopeBindings(ordered, state)
      .filter((sb) => liveInView(sb.binding, view));

    // Actions have no owning tool — `'&'`-channel phase atoms on their
    // bindings won't match.
    for (const action of ctx.actions.list()) {
      const targetScope: BindingScope = action.scope === 'hotkey' ? 'hotkey' : 'ambient';
      for (const binding of actionBindings(action)) {
        if (!liveInView(binding, view)) continue;
        result.push({ binding, scope: targetScope, ownerId: null });
      }
    }

    return result;
  }

  /** Snapshot the set of tool ids currently owning an in-flight handle —
   *  fed to `matchSorted` as the `engagedChannels` field of `PhaseContext`. */
  function snapshotEngagedChannels(): ReadonlySet<string> {
    if (inFlightOwners.size === 0) return EMPTY_ENGAGED;
    const out = new Set<string>();
    for (const owner of inFlightOwners.values()) {
      if (owner != null) out.add(owner);
    }
    return out;
  }

  /** Build an actionId → Action lookup from the registry. */
  function buildActionMap(registry: ActionSource): Map<string, Action> {
    const map = new Map<string, Action>();
    for (const action of registry.list()) {
      map.set(action.id, action);
    }
    return map;
  }

  // -------------------------------------------------------------------------
  // handleInput
  // -------------------------------------------------------------------------

  function runOnEnd(
    gestureId: string,
    handle: OngoingHandle,
    endCtx: InvocationCtx,
    reason: 'commit' | 'cancel',
  ): void {
    try {
      handle.onEnd?.(endCtx, reason);
    } catch (err) {
      console.error(`weasel dispatcher: gesture "${gestureId}" threw on onEnd`, err);
    }
  }

  /** End one in-flight gesture. It is out of flight before its `onEnd` runs,
   *  so an `onEnd` that throws, or that reads the dispatcher, sees it gone. */
  function endGesture(gestureId: string, event: InputEvent, reason: 'commit' | 'cancel'): boolean {
    const handle = inFlightHandles.get(gestureId);
    if (!handle) return false;
    const endCtx = buildInvocationCtx(event, {}, gestureId);
    inFlightHandles.delete(gestureId);
    inFlightOwners.delete(gestureId);
    inFlightActions.delete(gestureId);
    dragOrigins.delete(gestureId);
    dragPoints.delete(gestureId);
    pinchStartSpreads.delete(gestureId);
    runOnEnd(gestureId, handle, endCtx, reason);
    return true;
  }

  function handleInput(event: InputEvent, ctx: DispatcherContext): 'handled' | 'unhandled' {
    routedView = ctx.viewId;
    // --- Pump: check for key-held up-phase against in-flight handle ---
    if (event.kind === 'key-held' && event.phase === 'up') {
      const gestureId = gestureIdFor(event);
      // Whether we had a handle or not, this is a follow-up event, not a new match.
      return endGesture(gestureId, event, 'commit') ? 'handled' : 'unhandled';
    }

    // --- Pump: key-held DOWN re-dispatch for an already-engaged key is a
    //     no-op. This is the dispatcher-side defense against autorepeat
    //     keydowns (and any caller that re-dispatches) firing `start()`
    //     again — each start pushes a offhand hotkey, only one keyup ever
    //     fires onEnd, so the stack would leak. Treat as handled (we ARE
    //     holding the key) without re-invoking. ---
    if (event.kind === 'key-held' && event.phase === 'down') {
      const gestureId = gestureIdFor(event);
      if (inFlightHandles.has(gestureId)) {
        return 'handled';
      }
    }

    // --- Pump: pointermove → onMove on the in-flight drag handle ---
    if (event.kind === 'pointermove') {
      const gestureId = gestureIdFor(event);
      const handle = inFlightHandles.get(gestureId);
      if (!handle) return 'unhandled';
      // Accumulate the world-space point whether or not this handle previews.
      // `onEnd` is handed the same trail, so an action that only reads the
      // finished path — and therefore declares no `onMove` — must still get
      // every vertex rather than the press point alone.
      const pts = dragPoints.get(gestureId);
      if (pts) {
        pts.push({
          x: event.x,
          y: event.y,
          ...(event.pressure !== undefined ? { pressure: event.pressure } : {}),
          ...(event.tiltX !== undefined ? { tiltX: event.tiltX } : {}),
          ...(event.tiltY !== undefined ? { tiltY: event.tiltY } : {}),
        });
      }
      if (handle.onMove) {
        const moveCtx = buildInvocationCtx(event, {}, gestureId);
        handle.onMove(moveCtx);
        return 'handled';
      }
      return 'unhandled';
    }

    // --- Pump: pointerup → onEnd('commit') on the in-flight drag handle ---
    if (event.kind === 'pointerup') {
      const gestureId = gestureIdFor(event);
      return endGesture(gestureId, event, 'commit') ? 'handled' : 'unhandled';
    }

    // --- Pump: pointercancel → onEnd('cancel') on the in-flight drag handle ---
    if (event.kind === 'pointercancel') {
      const gestureId = gestureIdFor(event);
      return endGesture(gestureId, event, 'cancel') ? 'handled' : 'unhandled';
    }

    // --- Pump: multitouch end. The id carries the finger count the gesture
    //     opened with, which the hand has just left, so end by prefix. ---
    if (event.kind === 'multitouch' && event.end !== undefined) {
      let ended = false;
      for (const id of [...inFlightHandles.keys()]) {
        if (id.startsWith('multitouch-')) ended = endGesture(id, event, event.end) || ended;
      }
      return ended ? 'handled' : 'unhandled';
    }

    // --- Pump: multitouch move → onMove on the in-flight multitouch handle ---
    // When a multitouch event arrives with centroid/spread data AND a handle is
    // already in flight, route it to the handle's onMove. When no handle is in
    // flight, fall through to scope assembly so the event can start a new handle.
    if (event.kind === 'multitouch' && event.centroid !== undefined) {
      const gestureId = gestureIdFor(event);
      const handle = inFlightHandles.get(gestureId);
      if (handle?.onMove) {
        const moveCtx = buildInvocationCtx(event, {}, gestureId);
        handle.onMove(moveCtx);
        return 'handled';
      }
      // A hand is doing one multitouch gesture at a time, but the gesture id
      // carries the finger count — so a finger landing mid-gesture names a
      // different one, and the handle the hand has left is canceled here. (A
      // finger lifting arrives as an `end` event, above.)
      for (const id of [...inFlightHandles.keys()]) {
        if (id.startsWith('multitouch-') && id !== gestureId) endGesture(id, event, 'cancel');
      }
      // No in-flight handle → fall through to scope assembly + match below.
      // This allows the initial multitouch event (which carries centroid/spread)
      // to start a new ongoing handle on first dispatch.
    }

    const r = rank(event, ctx, DEV);
    const walked = walk(r, event, ctx, (match, action, deps) => invoke(event, match, action, deps), false);
    const outcome: 'handled' | 'unhandled' = walked.stop === 'fired' ? 'handled' : 'unhandled';
    if (DEV) recordTrace(buildDispatchRecord(r, walked, event, ctx, false, outcome));
    return outcome;
  }

  /** Run the winning candidate. `'fired'` ends the walk; `'empty-handle'`
   *  falls through to the next candidate; `'misbound'` ends it unhandled. */
  function invoke(
    event: InputEvent,
    match: MatchResult,
    action: Action,
    deps: ActionDeps,
  ): 'fired' | 'empty-handle' | 'misbound' {
    if (action.invoker?.timing === 'immediate') {
      try {
        // For wheel / click / doubleclick bindings, merge event-time
        // delta/position data into params so the immediate invoker
        // sees both binding-declared params (e.g. `kind: 'wheel'`)
        // and runtime event data. Option (a) from the design doc —
        // simpler than extending InvocationCtx for immediate invokers.
        const resolved = resolveParams(match.binding.opts?.params);
        let params: Record<string, unknown> | undefined;
        if (event.kind === 'wheel') {
          params = {
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            clientX: event.clientX,
            clientY: event.clientY,
            affordance: event.affordance,
            ...resolved,
          };
        } else if (event.kind === 'pinch') {
          params = {
            scale: event.scale,
            rotation: event.rotation,
            clientX: event.clientX,
            clientY: event.clientY,
            affordance: event.affordance,
            ...resolved,
          };
        } else if (event.kind === 'click' || event.kind === 'doubleclick') {
          params = {
            worldX: event.x,
            worldY: event.y,
            affordance: event.affordance,
            // Press point as well as release point — an action that places
            // geometry at the click wants the former. See `ClickEvent`.
            ...(event.kind === 'click'
              ? { pressX: event.pressX, pressY: event.pressY }
              : {}),
            mods: modifiersOf(event),
            ...resolved,
          };
        } else if (event.kind === 'contextmenu' || event.kind === 'longpress') {
          params = {
            worldX: event.x,
            worldY: event.y,
            affordance: event.affordance,
            bodyTarget: event.bodyTarget,
            mods: modifiersOf(event),
            ...resolved,
          };
        } else if (event.kind === 'pointerdown') {
          // Only `stage: 'press'` events reach an immediate invoker — the
          // buffered copy matches `drag` specs, which are ongoing.
          params = {
            worldX: event.x,
            worldY: event.y,
            affordance: event.affordance,
            bodyTarget: event.bodyTarget,
            mods: modifiersOf(event),
            ...resolved,
          };
        } else if (event.kind === 'drop' || event.kind === 'paste') {
          // External-content events: forward the materialized items and,
          // for drops, the world-space arrival point.
          params = {
            items: event.items,
            via: event.kind,
            ...(event.kind === 'drop' && event.x !== undefined
              ? { worldX: event.x, worldY: event.y }
              : {}),
            ...resolved,
          };
        } else {
          params = resolved;
        }
        action.invoker.run(deps, params);
      } catch (err) {
        console.error(`weasel dispatcher: action "${action.id}" invoker threw`, err);
      }
      return 'fired';
    }

    if (action.invoker?.timing === 'ongoing') {
      // A `pointerDown` binding fires at press time, on the same
      // `pointer-<id>` gesture id the drag will use. Letting an ongoing
      // action open its handle here would make the drag's own dispatch find
      // a handle already in flight and silently no-op. `PointerDownSpec`
      // documents itself as immediate-only; enforce it rather than let the
      // collision happen quietly.
      if (event.kind === 'pointerdown' && event.stage === 'press') {
        console.error(
          `weasel dispatcher: action "${action.id}" has an ongoing invoker but is bound to a `
          + `pointerDown spec, which fires at press time. Bind it to a drag spec, or give the `
          + `action an immediate invoker.`,
        );
        return 'misbound';
      }
      const gestureId = gestureIdFor(event);
      // Record the drag origin so subsequent pointermove events can compute delta.
      if (event.kind === 'pointerdown') {
        dragOrigins.set(gestureId, {
          x: event.x ?? 0,
          y: event.y ?? 0,
          ...(event.clientX !== undefined ? { clientX: event.clientX } : {}),
          ...(event.clientY !== undefined ? { clientY: event.clientY } : {}),
        });
        // Initialize empty drag-points history for the new gesture.
        dragPoints.set(gestureId, [{
          x: event.x ?? 0,
          y: event.y ?? 0,
          ...(event.pressure !== undefined ? { pressure: event.pressure } : {}),
          ...(event.tiltX !== undefined ? { tiltX: event.tiltX } : {}),
          ...(event.tiltY !== undefined ? { tiltY: event.tiltY } : {}),
        }]);
      }
      // Record start spread for pinch-zoom gestures.
      if (event.kind === 'multitouch' && event.spread !== undefined) {
        pinchStartSpreads.set(gestureId, event.spread);
      }
      const invCtx = buildInvocationCtx(event, deps, gestureId);
      const handle = action.invoker.start(invCtx, match.binding.opts);
      // Empty handle = "matched at the binding level but decided at runtime
      // not to handle this gesture" (missing dep, wrong affordance, wrong
      // selection kind, etc.). The widely-used early-return-empty pattern
      // depends on the dispatcher falling through to the next match —
      // otherwise the binding silently swallows the gesture.
      if (isEmptyOngoingHandle(handle)) {
        // Clean up the per-gesture state we set above so a later match
        // (still on the same pointerdown) sees a fresh slate.
        if (event.kind === 'pointerdown') {
          dragOrigins.delete(gestureId);
          dragPoints.delete(gestureId);
        }
        if (event.kind === 'multitouch') {
          pinchStartSpreads.delete(gestureId);
        }
        return 'empty-handle';
      }
      inFlightHandles.set(gestureId, handle);
      inFlightOwners.set(gestureId, match.ownerId);
      inFlightActions.set(gestureId, action);
      return 'fired';
    }

    // No invoker — action is registered but has nothing to do for this
    // matched binding. Treat as handled (the binding consumed the gesture
    // and the no-op is intentional) to keep dispatch deterministic.
    return 'fired';
  }

  // -------------------------------------------------------------------------
  // The walk — one computation behind dispatch, prediction and the record
  // -------------------------------------------------------------------------

  function rank(event: InputEvent, ctx: DispatcherContext, collectBarred: boolean): Ranking {
    const view = ctx.viewId ?? null;
    const outcome = matchSortedWithBarred(
      event, assembleScopedBindings(ctx), ctx.isMac, snapshotEngagedChannels(), { collectBarred },
    );
    const sorted = preferViewScoped(outcome.matches, view);
    const actionMap = buildActionMap(ctx.actions);
    const ruleCtx = ruleCtxOf(ctx);
    // Asked from the ranking, the filter and the record; a rule runs once per input.
    const held = new Map<Action, boolean>();
    const holds = (a: Action): boolean => {
      if (ruleCtx === undefined) return true;
      let h = held.get(a);
      if (h === undefined) held.set(a, h = isEligible(a, ruleCtx));
      return h;
    };
    // Ranking the ineligible alongside the rest leaves the survivors in the
    // order ranking them alone would: `preferContextual` only reorders within
    // a run of ties, and every tie's members sit together.
    const ordered = ruleCtx
      ? preferContextual(sorted, (id) => actionMap.get(id), holds, view)
      : sorted;
    return {
      ordered,
      barred: outcome.barred,
      ...(outcome.claimOwner !== undefined ? { claimOwner: outcome.claimOwner } : {}),
      actionMap,
      ruleCtx,
      eligible: (m) => {
        const a = actionMap.get(m.binding.actionId);
        return a === undefined || holds(a);
      },
    };
  }

  /**
   * Walk the ranked survivors, asking each action's `enabled()` in turn. With
   * `attempt`, the first that passes is run and the walk ends unless it bails;
   * without, it is the predicted winner. Each action is asked at most once.
   */
  function walk(
    r: Ranking,
    event: InputEvent,
    ctx: DispatcherContext,
    attempt: ((match: MatchResult, action: Action, deps: ActionDeps) => 'fired' | 'empty-handle' | 'misbound') | null,
    evaluateShadowed: boolean,
  ): Walked {
    const steps: Walked['steps'] = [];
    const tried = new Set<string>();
    let stop: Walked['stop'] = 'exhausted';
    let winner: Walked['winner'] = null;
    for (const match of r.ordered) {
      if (!r.eligible(match)) continue;
      const push = (step: WalkStep): void => { steps.push({ match, step }); };
      const actionId = match.binding.actionId;
      if (tried.has(actionId)) { push({ kind: 'duplicate' }); continue; }
      if (stop !== 'exhausted' && !evaluateShadowed) { push({ kind: 'not-asked' }); continue; }
      tried.add(actionId);
      const action = r.actionMap.get(actionId);
      if (!action) {
        if (attempt) {
          console.warn(
            `weasel dispatcher: binding resolved actionId "${actionId}" which has `
            + `no registered action. Skipping. (misconfiguration)`,
          );
        }
        push({ kind: 'no-such-action' });
        continue;
      }
      // Deps are built before the gate so predicates can read them; the
      // winner's invoke reuses the same bag. Shared with
      // `ActionsRegistry.trigger`, including the dev undeclared-read guard.
      const deps = buildDepsFromRequires(action, ctx.depRegistry);
      const enabled = action.enabled ? action.enabled(deps, worldPointOf(event)) : true;
      if (enabled !== true) { push({ kind: 'declined', reason: String(enabled) }); continue; }
      if (stop !== 'exhausted') { push({ kind: 'outranked' }); continue; }
      if (!attempt) {
        push({ kind: 'would-fire' });
        stop = 'fired';
        winner = { match, action };
        continue;
      }
      const result = attempt(match, action, deps);
      if (result === 'empty-handle') { push({ kind: 'empty-handle' }); continue; }
      push({ kind: result === 'fired' ? 'fired' : 'misbound' });
      stop = result;
      winner = { match, action };
    }
    return { steps, stop, winner };
  }

  // -------------------------------------------------------------------------
  // resolveAll / resolveOnly / explain — prediction without invocation
  // -------------------------------------------------------------------------

  function resolveAll(
    event: InputEvent,
    ctx: DispatcherContext,
    // Not `opts` — `createDispatcher`'s own `opts` is in scope here.
    resolveOpts?: ResolveAllOptions,
  ): ResolvedCandidate[] {
    const evaluateShadowed = resolveOpts?.evaluateShadowed ?? false;
    const r = rank(event, ctx, false);
    if (r.ordered.length === 0) return [];
    const walked = walk(r, event, ctx, null, evaluateShadowed);
    const stepOf = new Map(walked.steps.map((s) => [s.match, s.step]));

    // Verdict per action id, so a second binding for an action already judged
    // higher up inherits that verdict — the walk asks each action once.
    const verdictByAction = new Map<string, ResolvedCandidate['verdict']>();
    let fired = false;
    const out: ResolvedCandidate[] = [];
    for (const match of r.ordered) {
      const actionId = match.binding.actionId;
      const action = r.actionMap.get(actionId);
      // A binding pointing at an unregistered action can never fire.
      if (!action) continue;

      let verdict = verdictByAction.get(actionId);
      if (verdict === undefined) {
        if (!r.eligible(match)) {
          verdict = fired && !evaluateShadowed
            ? { kind: 'shadowed' }
            : { kind: 'ineligible', reason: describeEligible(action.eligible!) };
        } else {
          const step = stepOf.get(match);
          if (step?.kind === 'would-fire') {
            verdict = { kind: 'would-fire' };
            fired = true;
          } else if (step?.kind === 'declined') {
            verdict = { kind: 'disabled', reason: step.reason };
          } else {
            verdict = { kind: 'shadowed' };
          }
        }
        verdictByAction.set(actionId, verdict);
      } else if (verdict.kind === 'would-fire') {
        // The action already won on an earlier binding; this one never runs.
        verdict = { kind: 'shadowed' };
      }

      out.push({
        actionId,
        action,
        binding: match.binding,
        scope: match.scope,
        ownerId: match.ownerId,
        specificity: specificity(match.binding.spec),
        verdict,
      });
    }
    return out;
  }

  function resolveOnly(event: InputEvent, ctx: DispatcherContext): ResolveOnlyResult | null {
    const r = rank(event, ctx, false);
    const { winner } = walk(r, event, ctx, null, false);
    if (!winner) return null;
    return {
      actionId: winner.action.id,
      action: winner.action,
      scope: winner.match.scope,
      ownerId: winner.match.ownerId,
    };
  }

  function explain(event: InputEvent, ctx: DispatcherContext, explainOpts?: ResolveAllOptions): DispatchRecord {
    const r = rank(event, ctx, true);
    const walked = walk(r, event, ctx, null, explainOpts?.evaluateShadowed ?? false);
    return buildDispatchRecord(r, walked, event, ctx, true, walked.winner ? 'handled' : 'unhandled');
  }

  // -------------------------------------------------------------------------
  // cancelAll
  // -------------------------------------------------------------------------

  function cancelAll(reason: 'commit' | 'cancel'): void {
    const stubCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const ending = [...inFlightHandles];
    inFlightHandles.clear();
    inFlightOwners.clear();
    inFlightActions.clear();
    uiOngoingByAction.clear();
    dragOrigins.clear();
    dragPoints.clear();
    pinchStartSpreads.clear();
    for (const [gestureId, handle] of ending) runOnEnd(gestureId, handle, stubCtx, reason);
  }

  // -------------------------------------------------------------------------
  // inFlight
  // -------------------------------------------------------------------------

  function inFlight(): ReadonlyMap<string, OngoingHandle> {
    return inFlightHandles;
  }

  function inFlightCursor(): CursorSpec | null {
    // Latest start wins, matching `getActiveAction` — with a mouse and a pen
    // in flight together the cursor belongs to the gesture the user just
    // began, not the one they began first. Map iteration is insertion order
    // and each gestureId is set exactly once, so the last entry is the newest.
    let cursor: CursorSpec | null = null;
    for (const action of inFlightActions.values()) {
      const spec = action.activeCursor ?? action.cursor;
      // The spec, not its CSS form: a painted glyph resolves to 'none', which
      // would tell the pump to hide the cursor and paint nothing.
      if (spec !== undefined && resolveCursor(spec)) cursor = spec;
    }
    return cursor;
  }

  function getInFlightHandles(): Iterable<OngoingHandle> {
    return inFlightHandles.values();
  }

  function subscribe(fn: () => void): () => void {
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
  }

  function getVersion(): number {
    return version;
  }

  function getActiveAction(): { kind: string | null; id: string | null } {
    // The most-recently-started in-flight handle wins. `Map` preserves
    // insertion order; each gestureId is set exactly once (any pump
    // events `set` only on the initial `start`, and `delete` on end),
    // so iterating to the last entry gives us the latest start.
    let lastId: string | null = null;
    let lastHandle: OngoingHandle | null = null;
    for (const [id, handle] of inFlightHandles) {
      lastId = id;
      lastHandle = handle;
    }
    if (lastHandle === null) return { kind: null, id: null };
    return { kind: lastHandle.kind ?? null, id: lastId };
  }

  // Wrap handleInput + cancelAll to notify once per invocation that found or
  // left a gesture in flight. Done at the boundary (not inside the match
  // loop) so a start, a pump, and an end each fire exactly one notify. An
  // event with nothing in flight on either side changed nothing a subscriber
  // reads, and hover sends one per mouse move.
  const handleInputWithNotify: typeof handleInput = (event, ctx) => {
    const before = inFlightHandles.size;
    try {
      return handleInput(event, ctx);
    } finally {
      if (before > 0 || inFlightHandles.size > 0) notify();
    }
  };
  const cancelAllWithNotify: typeof cancelAll = (reason) => {
    const before = inFlightHandles.size;
    try {
      cancelAll(reason);
    } finally {
      if (before > 0) notify();
    }
  };

  function beginUiOngoing(
    actionId: string,
    deps: ActionDeps,
    params?: Record<string, unknown>,
  ): UiOngoingControl | null {
    const getAction = opts?.getAction;
    if (!getAction) {
      console.warn('weasel dispatcher: beginUiOngoing called but no getAction was provided to createDispatcher');
      return null;
    }
    const action = getAction(actionId);
    if (!action || !action.invoker || action.invoker.timing !== 'ongoing') {
      return null;
    }

    // Auto-commit any prior UI-driven handle for the same action.
    const prevGestureId = uiOngoingByAction.get(actionId);
    if (prevGestureId !== undefined) {
      const prevHandle = inFlightHandles.get(prevGestureId);
      if (prevHandle?.onEnd) {
        try { prevHandle.onEnd(buildUiInvocationCtx(deps), 'commit'); }
        catch (e) { console.error(`weasel dispatcher: prior UI handle for "${actionId}" threw on auto-commit`, e); }
      }
      inFlightHandles.delete(prevGestureId);
      inFlightOwners.delete(prevGestureId);
      uiOngoingByAction.delete(actionId);
    }

    const gestureId = `ui-${actionId}-${++uiOngoingSeq}`;
    let handle: OngoingHandle;
    try {
      // Pass params via BOTH ctx.params (the UI-driven channel) AND BindingOpts.params
      // (the gesture-driven channel). Color/opacity actions read ctx.params; future
      // ongoing actions migrated to UI-driven invocation can rely on either.
      handle = action.invoker.start(buildUiInvocationCtx(deps, params), { params });
    } catch (e) {
      console.error(`weasel dispatcher: action "${actionId}" threw on start`, e);
      return null;
    }
    // Treat empty handles ({} with no onMove or onEnd) as "did not engage".
    if (isEmptyOngoingHandle(handle)) {
      return null;
    }

    inFlightHandles.set(gestureId, handle);
    inFlightOwners.set(gestureId, null);
    uiOngoingByAction.set(actionId, gestureId);
    notify();

    let ended = false;
    // The dispatcher can end this handle without the control knowing —
    // `cancelAll` on tool switch, Escape, or unmount. Absence from
    // `inFlightHandles` is that signal; without it a later `end()` would
    // run `onEnd` a second time and commit over an already-cancelled gesture.
    const live = (): boolean => !ended && inFlightHandles.get(gestureId) === handle;
    return {
      gestureId,
      get active() { return live(); },
      update(nextParams) {
        if (!live()) return;
        if (!handle.onMove) return;
        try { handle.onMove(buildUiInvocationCtx(deps, nextParams)); }
        catch (e) { console.error(`weasel dispatcher: action "${actionId}" threw on onMove`, e); }
        notify();
      },
      end(reason) {
        if (!live()) { ended = true; return; }
        ended = true;
        if (handle.onEnd) {
          try { handle.onEnd(buildUiInvocationCtx(deps), reason); }
          catch (e) { console.error(`weasel dispatcher: action "${actionId}" threw on onEnd`, e); }
        }
        inFlightHandles.delete(gestureId);
        inFlightOwners.delete(gestureId);
        inFlightActions.delete(gestureId);
        if (uiOngoingByAction.get(actionId) === gestureId) {
          uiOngoingByAction.delete(actionId);
        }
        notify();
      },
    };
  }

  return {
    handleInput: handleInputWithNotify,
    resolveOnly,
    resolveAll,
    explain,
    cancelAll: cancelAllWithNotify,
    inFlight,
    inFlightCursor,
    getInFlightHandles,
    subscribe,
    getVersion,
    getActiveAction,
    beginUiOngoing,
  };
}
