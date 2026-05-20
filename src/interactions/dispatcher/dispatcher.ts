/**
 * Dispatcher orchestrator — pure module, no React, no DOM.
 *
 * Assembles `ScopedBinding[]` from the actions registry, active tool, and
 * hotkey stack; matches input events via `matchSorted`; gates each candidate
 * on `enabled()`; then invokes `immediate` or `ongoing` invokers and tracks
 * in-flight handles.
 *
 * ## Specificity-ordered fall-through
 * `matchSorted` returns every matching binding in precedence order
 * (hotkey > active > ambient, first-declared within scope). The dispatcher
 * walks that list and fires the first action whose `enabled()` returns
 * `true`. If every candidate's `enabled()` returns a disabled reason, the
 * event is unhandled. This mirrors CSS-style specificity matching with a
 * `:not(:disabled)` filter, and lets a tool declare a high-specificity
 * binding (e.g. drag-on-empty → areaSelect) that gracefully falls through
 * to a lower-specificity ambient binding (e.g. drag → viewport.dragPan)
 * when its required deps aren't wired.
 *
 * ## gestureId scheme
 * - `key-held` ongoing actions: `key-held-<key>` (e.g. `key-held- ` for Space).
 *   Chosen because key-held gestures are identified by the held key alone.
 * - `pointerdown` / drag ongoing actions: `pointer-<pointerId>`, where
 *   `pointerId` defaults to `'mouse'` (Phase 3 has no real pointer IDs; the
 *   React seam in Task 4 will supply the actual DOM pointerId).
 * - `multitouch` ongoing actions: `multitouch-<fingers>`.
 * - Fallback for any other kind that triggers an ongoing invoker: `ongoing-<kind>`.
 *
 * ## Action-lookup miss behavior
 * When `matchBest` resolves a binding whose `actionId` has no entry in
 * `ctx.actions.list()`, the dispatcher emits `console.warn` and returns
 * `'unhandled'`. The user's input gesture falls through as if unmatched.
 * This preserves input flow (nothing is swallowed silently) while flagging
 * the misconfiguration at dev time.
 */

import type { Action, ActionsRegistry, BoundGesture } from '../actions/registry';
import type { DepRegistry } from '../actions/depRegistry';
import type { GestureBinding } from '../actions/binding';
import type { OngoingHandle, InvocationCtx, ActionDeps, BindingOpts, AffordanceHit } from '../actions/invoker';
import { resolveParams } from '../actions/invoker';
import type { Tool } from '../../tools/types';
import type { InputEvent, BindingScope, ScopedBinding } from './matcher';
import { matchSorted } from './matcher';

// ---------------------------------------------------------------------------
// Dev-only instrumentation
// ---------------------------------------------------------------------------

/** True in dev builds; false in production. Tree-shakes the Proxy + trace
 *  log out of prod entirely. */
const DEV: boolean = (() => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
})();

/** One entry per `handleInput` call. Populated only in DEV; exposed on
 *  `window.__weaselDispatchLog__` so consumers / agents can `console.table`
 *  it to diagnose "X doesn't fire" complaints without redispatching agents. */
export interface DispatchLogEntry {
  ts: number;
  eventKind: string;
  candidates: Array<{ actionId: string; scope: BindingScope; enabledResult: boolean | string }>;
  fired: string | null;
  outcome: 'handled' | 'unhandled';
}

const TRACE_LIMIT = 200;
const traceLog: DispatchLogEntry[] = [];

if (DEV && typeof window !== 'undefined') {
  (window as unknown as { __weaselDispatchLog__: DispatchLogEntry[] }).__weaselDispatchLog__ = traceLog;
}

function recordTrace(entry: DispatchLogEntry): void {
  if (!DEV) return;
  traceLog.push(entry);
  if (traceLog.length > TRACE_LIMIT) traceLog.shift();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DispatcherContext {
  /** All registered actions; the dispatcher walks `.defaultBinding` for ambient bindings. */
  actions: ActionsRegistry;
  /** Dep sources keyed by name. */
  depRegistry: DepRegistry;
  /** Active tool's id (from ActiveToolContext). */
  activeToolId: string;
  /** Held-hotkey stack, top of stack last. */
  hotkeyStack: readonly string[];
  /** Lookup for tool definitions. */
  toolsById: ReadonlyMap<string, Tool>;
  /** Platform flag for `mod` shorthand resolution. */
  isMac: boolean;
}

export interface Dispatcher {
  /**
   * Route an input event through the binding pipeline. Returns `'handled'`
   * when a binding matched and the action invoked successfully (whether it
   * returned ops or not). Returns `'unhandled'` when no binding matched or
   * the matched action's `enabled()` returned a disabled reason.
   */
  handleInput(event: InputEvent, ctx: DispatcherContext): 'handled' | 'unhandled';

  /**
   * Synthesize an end-of-gesture for every in-flight ongoing handle.
   * Used by tool-switch cancellation (Q2 decision).
   */
  cancelAll(reason: 'commit' | 'cancel'): void;

  /**
   * Read-only view of currently in-flight ongoing handles, keyed by gestureId.
   * For debug/testing.
   */
  inFlight(): ReadonlyMap<string, OngoingHandle>;

  /**
   * Read-only iterator over currently in-flight `OngoingHandle` instances.
   *
   * Surface for the canvas's preview-ghost layer (`usePreviewGhostLayer`)
   * to walk each handle's `previewIds()` / `previewPose(id)` and render
   * dispatcher-driven gesture previews — Phase 14e. Read-only by design:
   * external consumers must not mutate the in-flight map.
   */
  getInFlightHandles(): Iterable<OngoingHandle>;

  /**
   * Subscribe to in-flight state changes. The callback fires after every
   * mutation that affects what the preview-ghost / dispatcher-overlay
   * layers read — handle start, every `onMove` pump, end, cancel,
   * cancel-all. Consumers re-read `getInFlightHandles()` and re-render.
   *
   * Returns an unsubscribe function.
   */
  subscribe(fn: () => void): () => void;
}

// ---------------------------------------------------------------------------
// createDispatcher
// ---------------------------------------------------------------------------

const EMPTY_ENGAGED: ReadonlySet<string> = new Set();

export function createDispatcher(): Dispatcher {
  const inFlightHandles = new Map<string, OngoingHandle>();
  /** gestureId → tool id that owns the binding which opened this handle.
   *  Used to compute the `engagedChannels` PhaseContext for the matcher.
   *  `null` when the opening binding came from an ambient action with no
   *  owning tool. */
  const inFlightOwners = new Map<string, string | null>();

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Per-gesture drag origin, keyed by gestureId.
   * Set when an ongoing drag handle is opened; used to compute deltas for
   * `pointermove` pump events.
   */
  const dragOrigins = new Map<string, { x: number; y: number }>();

  /** Subscribers fired after every state mutation. Layers that read from
   *  `getInFlightHandles()` use this to know when to re-render. */
  const subscribers = new Set<() => void>();
  function notify(): void {
    for (const fn of subscribers) fn();
  }

  /**
   * Per-gesture pointermove history (world-space points), keyed by gestureId.
   * Accumulated on every `pointermove` pump event. Passed as
   * `InvocationCtx.drag.points` so invokers that need the full path
   * (e.g. `lassoSelectAction`) can consume it.
   */
  const dragPoints = new Map<string, Array<{ x: number; y: number }>>();

  /**
   * Pinch-zoom start spread, keyed by multitouch gestureId.
   * Captured when the multitouch ongoing handle first opens.
   */
  const pinchStartSpreads = new Map<string, number>();

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
      screen: { x: 0, y: 0 },
      modifiers,
      deps,
    };

    // Populate gesture-kind-specific fields.
    if (event.kind === 'key') {
      base.key = { key: event.key, repeat: event.repeat ?? false };
    } else if (event.kind === 'key-held') {
      base.key = { key: event.key, repeat: false };
    } else if (event.kind === 'wheel') {
      base.wheel = { deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: 0 };
    } else if (event.kind === 'pointerdown' || event.kind === 'click') {
      const sx = event.kind === 'pointerdown' ? (event.x ?? 0) : 0;
      const sy = event.kind === 'pointerdown' ? (event.y ?? 0) : 0;
      base.screen = { x: sx, y: sy };
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
      base.screen = { x: cx, y: cy };
      base.world = { x: cx, y: cy };
      // Compute delta relative to drag origin if available.
      const origin = gestureId ? dragOrigins.get(gestureId) : undefined;
      const ox = origin?.x ?? cx;
      const oy = origin?.y ?? cy;
      const points = gestureId ? dragPoints.get(gestureId) : undefined;
      base.drag = {
        start: { x: ox, y: oy },
        current: { x: cx, y: cy },
        delta: { x: cx - ox, y: cy - oy },
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
      return `key-held-${event.key}`;
    }
    if (
      event.kind === 'pointerdown' ||
      event.kind === 'pointermove' ||
      event.kind === 'pointerup' ||
      event.kind === 'pointercancel'
    ) {
      return `pointer-mouse`;
    }
    if (event.kind === 'multitouch') {
      return `multitouch-${event.fingers}`;
    }
    return `ongoing-${event.kind}`;
  }

  /** Assemble the ScopedBinding list from all three scopes. */
  function assembleScopedBindings(ctx: DispatcherContext): ScopedBinding[] {
    const result: ScopedBinding[] = [];

    // Hotkey scope (top of stack = highest priority, iterated last so they
    // appear first in matchBest's inner loop — but matchBest itself iterates
    // by scope priority, so order within scope matters: last-in-stack = last-declared).
    for (const toolId of ctx.hotkeyStack) {
      const tool = ctx.toolsById.get(toolId);
      for (const binding of tool?.bindings ?? []) {
        result.push({ binding, scope: 'hotkey' as BindingScope, ownerToolId: toolId });
      }
    }

    // Active scope.
    const activeTool = ctx.toolsById.get(ctx.activeToolId);
    for (const binding of activeTool?.bindings ?? []) {
      result.push({ binding, scope: 'active' as BindingScope, ownerToolId: ctx.activeToolId });
    }

    // Ambient scope: walk the actions registry. Actions have no owning
    // tool — `'&'`-channel phase atoms on their bindings won't match.
    for (const action of ctx.actions.list()) {
      const gs = action.defaultBinding;
      if (!gs) continue;
      // Normalize to a flat array of { spec, opts? } pairs.
      // defaultBinding is GestureSpec | BoundGesture[].
      // BoundGesture = GestureSpec | { spec: GestureSpec; opts: BindingOpts }.
      // A bare GestureSpec has a `kind` field at top level; the object form
      // has a `spec` field (which itself has `kind`).
      const raw: BoundGesture[] = Array.isArray(gs) ? gs : [gs as BoundGesture];
      for (const entry of raw) {
        const isBoundObj = !('kind' in entry);
        const spec = isBoundObj
          ? (entry as { spec: import('../gestures/spec').GestureSpec; opts: BindingOpts }).spec
          : (entry as import('../gestures/spec').GestureSpec);
        const opts: BindingOpts | undefined = isBoundObj
          ? (entry as { spec: import('../gestures/spec').GestureSpec; opts: BindingOpts }).opts
          : undefined;
        const defaultBinding: GestureBinding = { spec, actionId: action.id, ...(opts !== undefined ? { opts } : {}) };
        result.push({ binding: defaultBinding, scope: 'ambient' as BindingScope, ownerToolId: null });
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
  function buildActionMap(registry: ActionsRegistry): Map<string, Action> {
    const map = new Map<string, Action>();
    for (const action of registry.list()) {
      map.set(action.id, action);
    }
    return map;
  }

  /** Build the deps bag for an action. */
  function buildDeps(action: Action, depRegistry: DepRegistry): ActionDeps {
    // `requires` is not on Action's public interface yet (Phase 3 stub).
    // Cast through unknown to read it if present without a type error.
    const requires = (action as unknown as { requires?: string[] }).requires ?? [];
    const entries = requires.map((name) => [name, depRegistry.get(name as never)]);
    const deps = Object.fromEntries(entries) as ActionDeps;

    // Dev-only: wrap deps in a Proxy that warns when the invoker reads a
    // key not declared in `requires`. Catches silent-failure-by-typo or
    // forgotten-requires (the #1 bug class in this codebase pre-Phase-14e).
    // Production builds: bypass the Proxy entirely (zero overhead).
    if (DEV) {
      const declared = new Set(requires);
      return new Proxy(deps as Record<string, unknown>, {
        get(target, prop, receiver) {
          if (typeof prop === 'string' && !declared.has(prop) && prop !== 'then') {
            // eslint-disable-next-line no-console
            console.warn(
              `[weasel:dispatcher] action "${action.id}" read deps.${prop} but did not declare it in \`requires\`. ` +
              `Add \`requires: [...'${prop}']\` to the descriptor or the dep will be undefined at runtime.`,
            );
          }
          return Reflect.get(target, prop, receiver);
        },
      }) as ActionDeps;
    }
    return deps;
  }

  // -------------------------------------------------------------------------
  // handleInput
  // -------------------------------------------------------------------------

  function handleInput(event: InputEvent, ctx: DispatcherContext): 'handled' | 'unhandled' {
    // --- Pump: check for key-held up-phase against in-flight handle ---
    if (event.kind === 'key-held' && event.phase === 'up') {
      const gestureId = gestureIdFor(event);
      const handle = inFlightHandles.get(gestureId);
      if (handle) {
        const stubCtx = buildInvocationCtx(event, {}, gestureId);
        handle.onEnd?.(stubCtx, 'commit');
        inFlightHandles.delete(gestureId);
        inFlightOwners.delete(gestureId);
        dragOrigins.delete(gestureId);
      }
      // Whether we had a handle or not, this is a follow-up event, not a new match.
      return handle ? 'handled' : 'unhandled';
    }

    // --- Pump: pointermove → onMove on the in-flight drag handle ---
    if (event.kind === 'pointermove') {
      const gestureId = gestureIdFor(event);
      const handle = inFlightHandles.get(gestureId);
      if (handle?.onMove) {
        // Accumulate world-space point into drag history before building ctx.
        const pts = dragPoints.get(gestureId);
        if (pts) {
          pts.push({ x: event.x, y: event.y });
        }
        const moveCtx = buildInvocationCtx(event, {}, gestureId);
        handle.onMove(moveCtx);
        return 'handled';
      }
      return 'unhandled';
    }

    // --- Pump: pointerup → onEnd('commit') on the in-flight drag handle ---
    if (event.kind === 'pointerup') {
      const gestureId = gestureIdFor(event);
      const handle = inFlightHandles.get(gestureId);
      if (handle) {
        const endCtx = buildInvocationCtx(event, {}, gestureId);
        handle.onEnd?.(endCtx, 'commit');
        inFlightHandles.delete(gestureId);
        inFlightOwners.delete(gestureId);
        dragOrigins.delete(gestureId);
        dragPoints.delete(gestureId);
      }
      return handle ? 'handled' : 'unhandled';
    }

    // --- Pump: pointercancel → onEnd('cancel') on the in-flight drag handle ---
    if (event.kind === 'pointercancel') {
      const gestureId = gestureIdFor(event);
      const handle = inFlightHandles.get(gestureId);
      if (handle) {
        const endCtx = buildInvocationCtx(event, {}, gestureId);
        handle.onEnd?.(endCtx, 'cancel');
        inFlightHandles.delete(gestureId);
        inFlightOwners.delete(gestureId);
        dragOrigins.delete(gestureId);
        dragPoints.delete(gestureId);
      }
      return handle ? 'handled' : 'unhandled';
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
      // No in-flight handle → fall through to scope assembly + match below.
      // This allows the initial multitouch event (which carries centroid/spread)
      // to start a new ongoing handle on first dispatch.
    }

    // --- Scope assembly ---
    const scopedBindings = assembleScopedBindings(ctx);

    // --- Match: get every matching binding, best → worst ---
    // Compute the engaged-channels set once per dispatch — the matcher
    // uses it to gate `phase`-qualified specs (`[engaged] wheel`, etc.).
    const engagedChannels = snapshotEngagedChannels();
    const matches = matchSorted(event, scopedBindings, ctx.isMac, engagedChannels);
    const traceCandidates: DispatchLogEntry['candidates'] = [];
    const finishTrace = (fired: string | null, outcome: 'handled' | 'unhandled') => {
      recordTrace({ ts: Date.now(), eventKind: event.kind, candidates: traceCandidates, fired, outcome });
    };
    if (matches.length === 0) {
      finishTrace(null, 'unhandled');
      return 'unhandled';
    }

    // --- Action lookup ---
    const actionMap = buildActionMap(ctx.actions);

    // --- Specificity-ordered fall-through ---
    // For each candidate, check the enabled gate. The first action that is
    // enabled wins. If every candidate is disabled (or missing), the event
    // is unhandled.
    for (const match of matches) {
      const action = actionMap.get(match.binding.actionId);
      if (!action) {
        traceCandidates.push({ actionId: match.binding.actionId, scope: match.scope, enabledResult: 'no-such-action' });
        console.warn(
          `weasel dispatcher: binding resolved actionId "${match.binding.actionId}" which has ` +
          `no registered action. Skipping. (misconfiguration)`,
        );
        continue;
      }

      if (action.enabled) {
        const result = action.enabled();
        if (result !== true) {
          traceCandidates.push({ actionId: action.id, scope: match.scope, enabledResult: String(result) });
          // Fall through to the next-best match.
          continue;
        }
      }
      traceCandidates.push({ actionId: action.id, scope: match.scope, enabledResult: true });

      // --- Invoke ---
      const deps = buildDeps(action, ctx.depRegistry);

      if (action.invoker?.timing === 'immediate') {
        try {
          // For wheel bindings, merge event-time delta/position data into params
          // so the invoker receives both binding-declared params (e.g. `kind: 'wheel'`)
          // and runtime event data (deltaX, deltaY, clientX, clientY). Option (a)
          // from the design doc — simpler than extending InvocationCtx for immediate invokers.
          const resolved = resolveParams(match.binding.opts?.params);
          const params: Record<string, unknown> | undefined =
            event.kind === 'wheel'
              ? { deltaX: event.deltaX, deltaY: event.deltaY, clientX: event.clientX, clientY: event.clientY, ...resolved }
              : resolved;
          action.invoker.run(deps, params);
        } catch (err) {
          console.error(`weasel dispatcher: action "${action.id}" invoker threw`, err);
        }
        finishTrace(action.id, 'handled');
        return 'handled';
      }

      if (action.invoker?.timing === 'ongoing') {
        const gestureId = gestureIdFor(event);
        // Record the drag origin so subsequent pointermove events can compute delta.
        if (event.kind === 'pointerdown') {
          dragOrigins.set(gestureId, { x: event.x ?? 0, y: event.y ?? 0 });
          // Initialize empty drag-points history for the new gesture.
          dragPoints.set(gestureId, [{ x: event.x ?? 0, y: event.y ?? 0 }]);
        }
        // Record start spread for pinch-zoom gestures.
        if (event.kind === 'multitouch' && event.spread !== undefined) {
          pinchStartSpreads.set(gestureId, event.spread);
        }
        const invCtx = buildInvocationCtx(event, deps, gestureId);
        const handle = action.invoker.start(invCtx, match.binding.opts);
        inFlightHandles.set(gestureId, handle);
        inFlightOwners.set(gestureId, match.ownerToolId);
        finishTrace(action.id, 'handled');
        return 'handled';
      }

      // No invoker — action is registered but has nothing to do for this
      // matched binding. Treat as handled (the binding consumed the gesture
      // and the no-op is intentional) to keep dispatch deterministic.
      finishTrace(action.id, 'handled');
      return 'handled';
    }

    // Every matching candidate was disabled or missing.
    finishTrace(null, 'unhandled');
    return 'unhandled';
  }

  // -------------------------------------------------------------------------
  // cancelAll
  // -------------------------------------------------------------------------

  function cancelAll(reason: 'commit' | 'cancel'): void {
    const stubCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    for (const handle of inFlightHandles.values()) {
      handle.onEnd?.(stubCtx, reason);
    }
    inFlightHandles.clear();
    inFlightOwners.clear();
    dragOrigins.clear();
    dragPoints.clear();
    pinchStartSpreads.clear();
  }

  // -------------------------------------------------------------------------
  // inFlight
  // -------------------------------------------------------------------------

  function inFlight(): ReadonlyMap<string, OngoingHandle> {
    return inFlightHandles;
  }

  function getInFlightHandles(): Iterable<OngoingHandle> {
    return inFlightHandles.values();
  }

  function subscribe(fn: () => void): () => void {
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
  }

  // Wrap handleInput + cancelAll to notify after every invocation. Done at
  // the boundary (not inside the match loop) so any mutation — start, pump,
  // end, no-op — fires exactly one notify per pump tick.
  const handleInputWithNotify: typeof handleInput = (event, ctx) => {
    const out = handleInput(event, ctx);
    notify();
    return out;
  };
  const cancelAllWithNotify: typeof cancelAll = (reason) => {
    cancelAll(reason);
    notify();
  };

  return {
    handleInput: handleInputWithNotify,
    cancelAll: cancelAllWithNotify,
    inFlight,
    getInFlightHandles,
    subscribe,
  };
}
