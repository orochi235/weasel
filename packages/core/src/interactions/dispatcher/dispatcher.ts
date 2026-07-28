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
import type { OngoingHandle, InvocationCtx, ActionDeps, BindingOpts, AffordanceHit, DragSample } from '../actions/invoker';
import { resolveParams } from '../actions/invoker';
import { buildDepsFromRequires } from '../actions/buildDeps';
import type { Tool } from '../../tools/types';
import type { InputEvent, BindingScope, ScopedBinding } from './matcher';
import { matchSorted } from './matcher';
import { evaluate, type Rule, type RuleCtx, type Condition } from '../../features/chrome-caps';

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

/** One entry per `handleInput` call. */
export interface DispatchLogEntry {
  kind: 'dispatch';
  ts: number;
  eventKind: string;
  /** For `key` / `key-held` events, the key id (`'Escape'`, `' '`, `'a'`).
   *  Lives on the event side of the entry — `fired` should describe
   *  what dispatched, not which key triggered it. */
  key?: string;
  candidates: Array<{ actionId: string; scope: BindingScope; enabledResult: boolean | string }>;
  fired: string | null;
  outcome: 'handled' | 'unhandled';
}

/** One entry per "mode change" — a kit state transition that isn't a
 *  dispatched input event but is load-bearing for understanding why an
 *  input was (or wasn't) handled later. Pushed via `recordModeSwitch()`;
 *  consumers include the editAnchors dep (editingId changes), and
 *  could expand to active-tool / hotkey-stack / focus changes. */
export interface ModeSwitchLogEntry {
  kind: 'mode';
  ts: number;
  /** Logical mode name, e.g. `'editAnchors.editingId'`. */
  mode: string;
  from: string | null;
  to: string | null;
  /** Optional free-form context — `'enterPathEdit'`, `'exitPathEdit'`,
   *  `'selection-dropped target'`, etc. */
  detail?: string;
}

export type TraceLogEntry = DispatchLogEntry | ModeSwitchLogEntry;

const TRACE_LIMIT = 200;

// `traceLog` is the rolling buffer; in dev it IS `window.__weaselDispatchLog__`
// so the ToolkitBuilder widget can poll it. Bind to the existing global if one
// is already present rather than reassigning a fresh array: an HMR
// re-evaluation of this module would otherwise create a new array and orphan
// the long-lived Dispatcher (held in a SceneCanvas `useRef` that survives Fast
// Refresh) whose `recordTrace` closure still pushes to the previous array — the
// widget would then read an array nothing writes to. Reuse keeps every module
// instance and the widget pointed at one shared array.
//
// `__weaselDispatchLog__` is the historical global; entries are a union of
// dispatch + mode-switch records. Filter via `(e) => e.kind === 'dispatch'` if
// you only want input routing.
const traceLog: TraceLogEntry[] =
  DEV && typeof window !== 'undefined'
    ? ((window as unknown as { __weaselDispatchLog__?: TraceLogEntry[] }).__weaselDispatchLog__ ??=
        [])
    : [];

function recordTrace(entry: TraceLogEntry): void {
  if (!DEV) return;
  traceLog.push(entry);
  if (traceLog.length > TRACE_LIMIT) traceLog.shift();
}

/** Push a mode-switch record into the trace log. Safe to call from
 *  anywhere; no-ops outside DEV. */
export function recordModeSwitch(
  mode: string,
  from: string | null,
  to: string | null,
  detail?: string,
): void {
  recordTrace({
    kind: 'mode',
    ts: Date.now(),
    mode,
    from,
    to,
    ...(detail !== undefined ? { detail } : {}),
  });
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
  /**
   * Thunk returning a fresh `RuleCtx` for the current frame. When
   * supplied, the dispatcher filters matched candidates by their
   * declared `Action.eligible` rule (omitted => always eligible).
   * When omitted, no eligibility filtering is applied — preserves
   * backward compatibility for callers (tests, legacy harnesses) that
   * don't wire up chrome-caps state.
   */
  getRuleCtx?: () => RuleCtx;
}

/**
 * Normalize an `Action.eligible` value to a raw `Rule`. Conditions are
 * callable functions carrying `.rule`; raw Rules are returned as-is.
 */
function eligibleToRule(eligible: Rule | Condition): Rule {
  return typeof eligible === 'function' ? (eligible as Condition).rule : eligible;
}

/**
 * Filter `matches` to only those whose backing action has no `eligible`
 * rule, or whose rule evaluates true against `ruleCtx`. Exported for
 * unit testing.
 *
 * @internal
 */
export function filterEligible<M extends { binding: { actionId: string } }>(
  matches: readonly M[],
  actionLookup: (id: string) => Action | undefined,
  ruleCtx: RuleCtx,
): M[] {
  return matches.filter((m) => {
    const action = actionLookup(m.binding.actionId);
    if (!action?.eligible) return true;
    return evaluate(eligibleToRule(action.eligible), ruleCtx);
  });
}

/**
 * Handle returned by `Dispatcher.beginUiOngoing()` for driving an
 * ongoing invoker from a UI control (color picker, slider).
 *
 *  - `update(params)` rebuilds an `InvocationCtx` with the new params and
 *    calls the handle's `onMove`. Safe to call many times.
 *  - `end(reason)` calls `onEnd(ctx, reason)` once and removes the handle
 *    from the in-flight map. Idempotent — further calls are no-ops.
 */
export interface UiOngoingControl {
  readonly gestureId: string;
  update(params?: Record<string, unknown>): void;
  end(reason: 'commit' | 'cancel'): void;
}

/**
 * Successful `Dispatcher.resolveOnly` prediction: the binding + action that
 * would fire if `event` were dispatched for real. `action` is the resolved
 * descriptor so callers (the hover-cursor pump) can read metadata like
 * `Action.cursor` without a second registry lookup.
 */
export interface ResolveOnlyResult {
  actionId: string;
  action: Action;
  scope: BindingScope;
  /** Tool id owning the winning binding; `null` for ambient action bindings. */
  ownerToolId: string | null;
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
   * Predict which action `event` would route to WITHOUT invoking it. Replays
   * the same walk as `handleInput` — scope assembly, specificity-sorted
   * match, eligibility filter, per-candidate `enabled()` gate — and returns
   * the first candidate that would fire, or `null` when the event would go
   * unhandled. Pure query: no invoker runs, no in-flight state changes, no
   * trace-log entry.
   *
   * Known divergence from a real dispatch: an ongoing invoker that matches
   * but returns an empty handle at `start()` (runtime bail) makes the real
   * dispatch fall through to the next candidate; prediction cannot see that
   * and reports the bailing action. Keep `enabled()` accurate on actions
   * that rely on prediction (hover cursors).
   */
  resolveOnly(event: InputEvent, ctx: DispatcherContext): ResolveOnlyResult | null;

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
   * CSS cursor for the gesture currently in flight, or `null` when nothing
   * is. Reads `Action.activeCursor` (falling back to `Action.cursor`) off the
   * action whose handle is open — the hover pump applies this instead of its
   * prediction once a gesture starts, which is how `grab` becomes `grabbing`.
   */
  inFlightCursor(): string | null;

  /**
   * Read-only iterator over currently in-flight `OngoingHandle` instances.
   *
   * Surface for the canvas's preview-ghost layer (`usePreviewGhostLayer`)
   * to walk each handle's `previewIds()` / `previewPose(id)` and render
   * dispatcher-driven gesture previews. Read-only by design:
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

  /**
   * Snapshot of the currently active action, for surfaces (chrome-caps
   * visibility rules, debug HUDs) that need to react to "what action
   * is in flight right now."
   *
   * - `kind` — the `OngoingHandle.kind` reported by the in-flight
   *   handle (e.g. `'marquee'`, `'move'`). `null` when no action is
   *   in flight OR the handle didn't declare a kind.
   * - `id` — the dispatcher's internal `gestureId` (`pointer-mouse`,
   *   `key-held-Space`, …) — the pointer/key channel the action rode
   *   in on. `null` when no action is in flight.
   *
   * When multiple handles are in flight simultaneously (e.g. a key-held
   * action overlapping a pointer action), the most-recently-started
   * handle wins. This matches user intent: the latest interaction is
   * the one consumers care about.
   */
  getActiveAction(): { kind: string | null; id: string | null };

  /**
   * Start an ongoing action driven by UI (not a gesture). Builds an
   * `InvocationCtx` with the given `deps` and `params`, calls
   * `action.invoker.start(ctx, { params })`, and registers the returned
   * handle in the in-flight map so `getInFlightHandles()` reports it —
   * enabling preview rendering via `SceneCanvas`.
   *
   * Returns `null` if `actionId` is unknown, the action's invoker is not
   * ongoing, or `start` returned an empty handle.
   *
   * If a UI-driven handle for the same `actionId` is already in flight,
   * it is committed (`end('commit')`) before the new one starts.
   */
  beginUiOngoing(
    actionId: string,
    deps: ActionDeps,
    params?: Record<string, unknown>,
  ): UiOngoingControl | null;
}

// ---------------------------------------------------------------------------
// createDispatcher
// ---------------------------------------------------------------------------

const EMPTY_ENGAGED: ReadonlySet<string> = new Set();

/**
 * Modifier flags as an immediate invoker sees them, in the kit's
 * `ModifierState` spelling rather than the DOM's `*Key` one.
 *
 * Ongoing invokers read modifiers off `InvocationCtx`; immediate ones get only
 * `(deps, params)`, so pointer-driven immediate actions need them merged into
 * params the same way wheel deltas already are. Most actions should still
 * express modifier semantics as separate bindings with `opts.params` — that is
 * what makes them visible to conflict detection and the inspector. This is for
 * the cases where the modifier is data rather than a route, e.g. select
 * forwarding the press's modifiers into `SelectionApi.applyClick`, which
 * resolves them against the host's configured extend key.
 */
function modifiersOf(e: {
  altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean;
}): { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean } {
  return { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey };
}

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
  function notify(): void {
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

  /** Build a zero-position InvocationCtx for UI-driven invocations (no
   *  pointer event involved — world/screen coords are irrelevant). */
  function buildUiInvocationCtx(deps: ActionDeps, params?: Record<string, unknown>): InvocationCtx {
    return {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
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
        const targetScope: BindingScope = action.scope === 'hotkey' ? 'hotkey' : 'ambient';
        result.push({ binding: defaultBinding, scope: targetScope, ownerToolId: null });
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
        inFlightActions.delete(gestureId);
        dragOrigins.delete(gestureId);
      }
      // Whether we had a handle or not, this is a follow-up event, not a new match.
      return handle ? 'handled' : 'unhandled';
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
      if (handle?.onMove) {
        // Accumulate world-space point into drag history before building ctx.
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
        inFlightActions.delete(gestureId);
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
        inFlightActions.delete(gestureId);
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
    const rawMatches = matchSorted(event, scopedBindings, ctx.isMac, engagedChannels);
    const traceCandidates: DispatchLogEntry['candidates'] = [];
    const eventKey =
      event.kind === 'key' || event.kind === 'key-held' ? event.key : undefined;
    const finishTrace = (fired: string | null, outcome: 'handled' | 'unhandled') => {
      recordTrace({
        kind: 'dispatch',
        ts: Date.now(),
        eventKind: event.kind,
        ...(eventKey !== undefined ? { key: eventKey } : {}),
        candidates: traceCandidates,
        fired,
        outcome,
      });
    };
    if (rawMatches.length === 0) {
      finishTrace(null, 'unhandled');
      return 'unhandled';
    }

    // --- Action lookup ---
    const actionMap = buildActionMap(ctx.actions);

    // --- Eligibility filter (mode-aware-dispatch) ---
    // When a `RuleCtx` is available, strip candidates whose action's
    // `eligible` rule evaluates false. This is defense-in-depth: even
    // if a stale affordance hit slips through, the dispatcher refuses
    // to fire an action declared ineligible for the active mode.
    const ruleCtx = ctx.getRuleCtx?.();
    const matches = ruleCtx
      ? filterEligible(rawMatches, (id) => actionMap.get(id), ruleCtx)
      : rawMatches;
    if (matches.length === 0) {
      finishTrace(null, 'unhandled');
      return 'unhandled';
    }

    // --- Specificity-ordered fall-through ---
    // For each candidate, check the enabled gate. The first action that is
    // enabled wins. If every candidate is disabled (or missing), the event
    // is unhandled.
    //
    // Action-level dedup: `assembleScopedBindings` may push the same binding
    // twice — once from the active tool's `bindings` and once from the
    // ambient action-registry walk. Without dedup, an empty-handle fall-
    // through (`continue` below) would invoke the SAME action's start()
    // twice. We try each *action* at most once per dispatch.
    const triedActionIds = new Set<string>();
    for (const match of matches) {
      if (triedActionIds.has(match.binding.actionId)) continue;
      triedActionIds.add(match.binding.actionId);
      const action = actionMap.get(match.binding.actionId);
      if (!action) {
        traceCandidates.push({ actionId: match.binding.actionId, scope: match.scope, enabledResult: 'no-such-action' });
        console.warn(
          `weasel dispatcher: binding resolved actionId "${match.binding.actionId}" which has ` +
          `no registered action. Skipping. (misconfiguration)`,
        );
        continue;
      }

      // Build deps before the enabled gate so deps-aware predicates can inspect
      // them (selection-gated actions, escape's path-edit fall-through, …). The
      // gate previously ran `enabled()` with no args, so any predicate reading
      // `deps?.x` saw `undefined` and either fell through forever (constant
      // `SelectionRequired` stubs) or silently ignored its gate. The winning
      // action's invoke path below reuses this same bag.
      // Shared with `ActionsRegistry.trigger` — includes the dev-mode
      // undeclared-read guard (Proxy warn on deps not in `requires`).
      const deps = buildDepsFromRequires(action, ctx.depRegistry);

      if (action.enabled) {
        const result = action.enabled(deps);
        if (result !== true) {
          traceCandidates.push({ actionId: action.id, scope: match.scope, enabledResult: String(result) });
          // Fall through to the next-best match.
          continue;
        }
      }
      traceCandidates.push({ actionId: action.id, scope: match.scope, enabledResult: true });

      // --- Invoke ---

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
              ...resolved,
            };
          } else if (event.kind === 'click' || event.kind === 'doubleclick') {
            params = {
              worldX: event.worldX,
              worldY: event.worldY,
              // Press point as well as release point — an action that places
              // geometry at the click wants the former. See `ClickEvent`.
              ...(event.kind === 'click'
                ? { pressX: event.pressX, pressY: event.pressY }
                : {}),
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
        finishTrace(action.id, 'handled');
        return 'handled';
      }

      if (action.invoker?.timing === 'ongoing') {
        // A `pointerDown` binding fires at press time, on the same
        // `pointer-mouse` gesture id the drag will use. Letting an ongoing
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
          finishTrace(action.id, 'unhandled');
          return 'unhandled';
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
          traceCandidates.push({ actionId: action.id, scope: match.scope, enabledResult: 'empty-handle' });
          continue;
        }
        inFlightHandles.set(gestureId, handle);
        inFlightOwners.set(gestureId, match.ownerToolId);
        inFlightActions.set(gestureId, action);
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
  // resolveOnly
  // -------------------------------------------------------------------------

  function resolveOnly(event: InputEvent, ctx: DispatcherContext): ResolveOnlyResult | null {
    const scopedBindings = assembleScopedBindings(ctx);
    const engagedChannels = snapshotEngagedChannels();
    const rawMatches = matchSorted(event, scopedBindings, ctx.isMac, engagedChannels);
    if (rawMatches.length === 0) return null;

    const actionMap = buildActionMap(ctx.actions);
    const ruleCtx = ctx.getRuleCtx?.();
    const matches = ruleCtx
      ? filterEligible(rawMatches, (id) => actionMap.get(id), ruleCtx)
      : rawMatches;

    // Same specificity-ordered fall-through as handleInput, minus invocation:
    // each action is tried at most once; the first one whose `enabled()`
    // passes is the predicted winner.
    const triedActionIds = new Set<string>();
    for (const match of matches) {
      if (triedActionIds.has(match.binding.actionId)) continue;
      triedActionIds.add(match.binding.actionId);
      const action = actionMap.get(match.binding.actionId);
      if (!action) continue;
      if (action.enabled) {
        const deps = buildDepsFromRequires(action, ctx.depRegistry);
        if (action.enabled(deps) !== true) continue;
      }
      return {
        actionId: action.id,
        action,
        scope: match.scope,
        ownerToolId: match.ownerToolId,
      };
    }
    return null;
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
    inFlightActions.clear();
    uiOngoingByAction.clear();
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

  function inFlightCursor(): string | null {
    for (const action of inFlightActions.values()) {
      const cursor = action.activeCursor ?? action.cursor;
      if (cursor) return cursor;
    }
    return null;
  }

  function getInFlightHandles(): Iterable<OngoingHandle> {
    return inFlightHandles.values();
  }

  function subscribe(fn: () => void): () => void {
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
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
    return {
      gestureId,
      update(nextParams) {
        if (ended) return;
        if (!handle.onMove) return;
        try { handle.onMove(buildUiInvocationCtx(deps, nextParams)); }
        catch (e) { console.error(`weasel dispatcher: action "${actionId}" threw on onMove`, e); }
        notify();
      },
      end(reason) {
        if (ended) return;
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
    cancelAll: cancelAllWithNotify,
    inFlight,
    inFlightCursor,
    getInFlightHandles,
    subscribe,
    getActiveAction,
    beginUiOngoing,
  };
}
