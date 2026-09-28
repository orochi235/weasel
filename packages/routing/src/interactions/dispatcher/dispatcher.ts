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
 * - `key-held` ongoing actions: `key-held-<key>` (e.g. `key-held- ` for Space).
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
 * When `matchBest` resolves a binding whose `actionId` has no entry in
 * `ctx.actions.list()`, the dispatcher emits `console.warn` and returns
 * `'unhandled'`. The user's input gesture falls through as if unmatched.
 * This preserves input flow (nothing is swallowed silently) while flagging
 * the misconfiguration at dev time.
 */


import type { Action, ActionSource } from '../actions/action';
import { actionBindings } from '../actions/binding';
import type { DepRegistry } from '../actions/depNode';
import type { GestureBinding } from '../actions/binding';
import type { GestureSpec } from '@weasel-js/gestures';
import type { OngoingHandle, InvocationCtx, ActionDeps, AffordanceHit, DragSample, Point2 } from '../actions/invoker';
import { resolveParams } from '../actions/invoker';
import { buildDepsFromRequires } from '../actions/buildDeps';
import type { Contribution } from '../../contributions/types';
import { scopeBindings } from '../../contributions/assemble';
import type { InputEvent, BindingScope, MatchResult, ScopedBinding } from './matcher';
import { matchSortedWithBarred, specificity } from './matcher';
import { routesForSpec } from '../../tools/routing/reflection/registry';
import type {
  DispatchRecord, DroppedCandidate, PlacedBy, RankedCandidate, RecordCandidate, SpecificityPart,
  WalkStep,
} from './dispatchRecord';
import { evaluate, describeRule, type Rule, type RuleCtx, type Condition } from '../../eligibility';
import { resolveCursor } from '@weasel-js/cursor';
import type { CapabilityTag } from '@weasel-js/modes';

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

/** A trace entry: one {@link DispatchRecord} per resolved input, or a mode switch. */
export type TraceLogEntry = DispatchRecord | ModeSwitchLogEntry;

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

/**
 * Dev only: offer the record for what a press at the pointer would do, as a
 * thunk on `window.__weaselDispatchLive__`. The hover pump offers one per move
 * and a reader builds the record only when it looks, so no record is built
 * while nothing is watching. `null` withdraws it when the pointer leaves.
 *
 * @internal
 */
export function publishLiveDispatch(explain: (() => DispatchRecord) | null): void {
  if (!DEV || typeof window === 'undefined') return;
  (window as unknown as { __weaselDispatchLive__?: (() => DispatchRecord) | null })
    .__weaselDispatchLive__ = explain;
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

/** Everything the dispatcher must consult to route one input event: the
 *  registered actions and their deps, which tool is active, which hotkeys are
 *  held, and — optionally — the chrome state that action eligibility rules are
 *  evaluated against. Rebuilt per event rather than held, so the dispatcher
 *  itself stays stateless apart from in-flight gestures. */
export interface DispatcherContext {
  /** All registered actions; the dispatcher walks `.defaultBinding` for ambient bindings. */
  actions: ActionSource;
  /** Dep sources keyed by name. */
  depRegistry: DepRegistry;
  /** Active tool's id (from ActiveToolContext); `null` when none is. */
  activeToolId: string | null;
  /** Held-hotkey stack, top of stack last. */
  hotkeyStack: readonly string[];
  /** Every registered entry, tools and ambient contributions alike, by id. */
  entriesById: ReadonlyMap<string, Contribution<unknown>>;
  /** Platform flag for `mod` shorthand resolution. */
  isMac: boolean;
  /**
   * Thunk returning a fresh `RuleCtx` for the current frame — the routed
   * view's, when the surface hosts several. When it answers, the dispatcher
   * filters matched candidates by their declared `Action.eligible` rule
   * (omitted => always eligible). Absent, or answering `undefined`, applies
   * no eligibility filtering.
   */
  getRuleCtx?: () => RuleCtx | undefined;
  /**
   * The view this input landed in — a view id, or `null` for the surface's
   * own camera. Bindings whose `opts.views` omit it are not live, those naming
   * it outrank the rest, and it reaches the invoker as `InvocationCtx.viewId`
   * and rules as `RuleCtx.viewId`. Absent means the host routes no views, which
   * reads as the root.
   */
  viewId?: string | null;
}

/** Whether `binding` is live for input routed to `view`. */
function liveInView(binding: GestureBinding, view: string | null): boolean {
  const views = binding.opts?.views;
  return views === undefined || views.includes(view);
}

/** Stable partition: matches whose binding names `view` first. See
 *  `BindingOpts.views` for why naming the view outranks the scope tier. */
function namesView(binding: GestureBinding, view: string | null): boolean {
  return binding.opts?.views?.includes(view) ?? false;
}

function preferViewScoped<M extends { binding: GestureBinding }>(
  matches: readonly M[],
  view: string | null,
): M[] {
  const named: M[] = [];
  const rest: M[] = [];
  for (const m of matches) {
    (namesView(m.binding, view) ? named : rest).push(m);
  }
  return named.length === 0 ? [...matches] : [...named, ...rest];
}

/** The routed view's rule context, carrying the view id. */
function ruleCtxOf(ctx: DispatcherContext): RuleCtx | undefined {
  const r = ctx.getRuleCtx?.();
  return r ? { ...r, viewId: ctx.viewId ?? null } : undefined;
}

/**
 * Normalize an `Action.eligible` value to a raw `Rule`. Conditions are
 * callable functions carrying `.rule`; raw Rules are returned as-is.
 */
function eligibleToRule(eligible: Rule | Condition): Rule {
  return typeof eligible === 'function' ? (eligible as Condition).rule : eligible;
}

/** Does `action`'s declared eligibility rule pass against `ruleCtx`?
 *  An action with no `eligible` rule is always eligible. */
function isEligible(action: Action, ruleCtx: RuleCtx): boolean {
  if (!action.eligible) return true;
  return evaluate(eligibleToRule(action.eligible), ruleCtx);
}

/** Render an `eligible` rule for display. `evaluate()` returns a bare
 *  boolean, so there is no reason string to carry — the rule itself is the
 *  most informative thing available. */
function describeEligible(eligible: NonNullable<Action['eligible']>): string {
  return describeRule(eligibleToRule(eligible));
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
    if (!action) return true;
    return isEligible(action, ruleCtx);
  });
}

/**
 * Among matches tied on scope and specificity, put those whose action is
 * gated by an `eligible` rule that holds now ahead of those with no rule: a
 * binding that applies only in the current context — Escape while editing a
 * path — outranks one that applies everywhere. Otherwise stable.
 *
 * @internal
 */
export function preferContextual<M extends { binding: GestureBinding; scope: string }>(
  matches: readonly M[],
  actionLookup: (id: string) => Action | undefined,
  /** Whether a gated action's rule holds; skip re-asking where the matches
   *  were already filtered by it. */
  holds: (action: Action) => boolean,
  /** The routed view: a binding naming it is never tied with one that does not. */
  view: string | null,
): M[] {
  const out: M[] = [];
  let run: M[] = [];
  const flush = (): void => {
    const gated = run.filter((m) => {
      const action = actionLookup(m.binding.actionId);
      return action?.eligible !== undefined && holds(action);
    });
    out.push(...gated, ...run.filter((m) => !gated.includes(m)));
    run = [];
  };
  for (const m of matches) {
    const head = run[0];
    if (
      head
      && (head.scope !== m.scope
        || namesView(head.binding, view) !== namesView(m.binding, view)
        || !sameSpecificity(head.binding.spec, m.binding.spec))
    ) flush();
    run.push(m);
  }
  flush();
  return out;
}

const SPECIFICITY_PARTS: readonly SpecificityPart[] = ['target', 'mods', 'phase', 'exact'];

/** The ranking step that put `cur` directly below `prev`. `contextual` says
 *  `prev` is gated by a rule that holds and `cur` is not — the only thing the
 *  step after specificity looks at. */
function placedBy(
  prev: MatchResult,
  cur: MatchResult,
  view: string | null,
  contextual: boolean,
): PlacedBy {
  if (namesView(prev.binding, view) !== namesView(cur.binding, view)) return { step: 'view' };
  if (prev.scope !== cur.scope) return { step: 'tier' };
  const sp = specificity(prev.binding.spec);
  const sc = specificity(cur.binding.spec);
  const i = sp.findIndex((v, k) => v !== sc[k]);
  if (i >= 0) return { step: 'specificity', part: SPECIFICITY_PARTS[i]! };
  return contextual ? { step: 'context' } : { step: 'order' };
}

function sameSpecificity(a: GestureSpec, b: GestureSpec): boolean {
  const sa = specificity(a);
  const sb = specificity(b);
  return sa.every((v, i) => v === sb[i]);
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
  ownerId: string | null;
}

/**
 * One candidate from `Dispatcher.resolveAll` — a binding that matched the
 * event, with why it did or didn't get to fire.
 *
 * Verdicts:
 *  - `would-fire`  — eligible, `enabled()` passed, and nothing above it fired.
 *    At most one candidate per call carries this.
 *  - `ineligible`  — the action's `eligible` rule evaluated false against the
 *    live `RuleCtx`. `reason` is the rule, serialized.
 *  - `disabled`    — `enabled()` returned a disabled reason, carried verbatim.
 *  - `shadowed`    — never asked, for one of two reasons: something above it
 *    already fired, or it is a repeat binding of the action that itself won
 *    higher in the list (several bindings may point at one action, and the
 *    dispatcher runs each action at most once). A repeat of an action that was
 *    already judged `ineligible` or `disabled` is NOT shadowed — it inherits
 *    that action's verdict, since that is the reason it doesn't fire.
 */
export interface ResolvedCandidate {
  actionId: string;
  action: Action;
  binding: GestureBinding;
  scope: BindingScope;
  ownerId: string | null;
  /** The tuple from `specificity(binding.spec)`, surfaced so a reader can see
   *  why one candidate outranks another rather than inferring it. */
  specificity: readonly [number, number, number, number];
  verdict:
    | { kind: 'would-fire' }
    | { kind: 'ineligible'; reason: string }
    | { kind: 'disabled'; reason: string }
    | { kind: 'shadowed' };
}

/** Options for {@link Dispatcher.resolveAll}. */
export interface ResolveAllOptions {
  /**
   * Evaluate eligibility and `enabled()` for candidates below the winner
   * instead of short-circuiting them to `shadowed`.
   *
   * Off by default, and deliberately so: the default walk's early exit is what
   * keeps `resolveOnly`'s `enabled()` call count identical to a real dispatch,
   * and `enabled()` predicates are only contractually pure — not free.
   *
   * Turn it on for diagnostics, where "this one was outranked" is a less
   * useful answer than "this one was outranked AND would have been disabled
   * anyway". With it on, `shadowed` narrows to its precise meaning: this
   * candidate would have fired, but something above it did.
   */
  evaluateShadowed?: boolean;
}

/**
 * Routes input events to actions.
 *
 * For each event it assembles the bindings in scope (hotkey, then active tool,
 * then ambient), matches them in specificity order, filters by eligibility and
 * each action's `enabled` gate, and invokes the first survivor. Ongoing
 * actions — anything that runs across a drag — are kept in flight here and
 * pumped with subsequent moves until the gesture ends.
 */
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
   * Every binding that matches `event`, in dispatch precedence order, each
   * with a verdict explaining whether it would fire. Same walk as
   * `resolveOnly` — scope assembly, specificity-sorted match, eligibility
   * check, per-candidate `enabled()` gate — without stopping at the winner
   * and without invoking anything. Nothing is dropped: candidates that
   * `resolveOnly`'s walk would filter out are kept here and labelled
   * `ineligible` instead. Pure query: no invoker runs, no in-flight state
   * changes, no trace-log entry.
   *
   * `resolveOnly` is the first `would-fire` entry of this list.
   *
   * Shares `resolveOnly`'s known divergence from a real dispatch: an ongoing
   * invoker that matches but returns an empty handle at `start()` makes the
   * real dispatch fall through, and this cannot see that.
   *
   * By default everything below the winner is `shadowed` without being asked,
   * which is what keeps this walk as cheap as the dispatch it replays. Pass
   * `{ evaluateShadowed: true }` to keep evaluating past the winner, so a
   * lower candidate that is ALSO ineligible or disabled says so — see
   * {@link ResolveAllOptions.evaluateShadowed}.
   */
  resolveAll(
    event: InputEvent,
    ctx: DispatcherContext,
    opts?: ResolveAllOptions,
  ): ResolvedCandidate[];

  /**
   * The full {@link DispatchRecord} for `event` — what matched, what each
   * filter dropped, how the rest ranked and why, and the walk — without
   * invoking anything, so `predicted` is true and the winner is `would-fire`.
   * It is the same computation `handleInput` and `resolveAll` run. Costs more
   * than `resolveOnly`: it renders every candidate's routes and rule.
   */
  explain(event: InputEvent, ctx: DispatcherContext, opts?: ResolveAllOptions): DispatchRecord;

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
   * Monotonic counter bumped on exactly the events {@link subscribe} fires
   * on. The snapshot half of the `useSyncExternalStore` contract: pair it
   * with `subscribe` to drive a render off in-flight gesture state without
   * a `useReducer` force-rerender.
   *
   * Starts at 0 and only ever increases. Two reads returning the same number
   * mean nothing pumped in between; it does **not** guarantee that a bump
   * changed anything observable (a pump that matched no binding still
   * counts — see `subscribe`).
   */
  getVersion(): number;

  /**
   * Snapshot of the currently active action, for surfaces (chrome-caps
   * visibility rules, debug HUDs) that need to react to "what action
   * is in flight right now."
   *
   * - `kind` — the `OngoingHandle.kind` reported by the in-flight
   *   handle (e.g. `'marquee'`, `'move'`). `null` when no action is
   *   in flight OR the handle didn't declare a kind.
   * - `id` — the dispatcher's internal `gestureId` (`pointer-1`,
   *   `key-held-Space`, …) — the pointer/key channel the action rode
   *   in on. `null` when no action is in flight.
   *
   * When multiple handles are in flight simultaneously (e.g. a key-held
   * action overlapping a pointer action), the most-recently-started
   * handle wins. This matches user intent: the latest interaction is
   * the one consumers care about.
   *
   * That rule used to be near-vacuous on the pointer side, because every
   * pointer shared one handle slot and two pointer drags could not coexist.
   * With per-pointer keying they can — but only via paths that bypass the
   * multi-pointer policy in `useGestureDispatcher` (which stops a second
   * finger from opening a drag while a pinch is live), such as a mouse and
   * a pen used together. Latest-start remains the right answer there.
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

/** The world point an event landed on, for `Action.enabled`'s position
 *  argument. Undefined for events with no position (keys, drops, pastes). */
function worldPointOf(event: InputEvent): { x: number; y: number } | undefined {
  switch (event.kind) {
    case 'pointerdown':
    case 'longpress':
    case 'click':
    case 'doubleclick':
    case 'contextmenu':
      return event.x !== undefined && event.y !== undefined ? { x: event.x, y: event.y } : undefined;
    default:
      return undefined;
  }
}

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
      return `key-held-${event.key}`;
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
    // Hotkey-engaged entries lead, so stack order breaks ties within that tier
    // — newest hold first. `pushHotkey` appends and every other reader takes
    // the top as the engaged one (`ToolsApi.hotkeyEngaged` is `.at(-1)`), so
    // walking the stack bottom-first handed ties to the oldest hold and routed
    // a drag to a tool the rest of the kit did not consider engaged.
    const ordered: Contribution<unknown>[] = [];
    for (let i = ctx.hotkeyStack.length - 1; i >= 0; i--) {
      const id = ctx.hotkeyStack[i]!;
      const entry = ctx.entriesById.get(id);
      if (entry && !ordered.includes(entry)) ordered.push(entry);
    }
    for (const entry of ctx.entriesById.values()) {
      if (!ordered.includes(entry)) ordered.push(entry);
    }
    // `Eligibility.capabilities` is a tool-level gate over the same tags the
    // `capability:` selector reads. It is the only one that fires for a tool
    // whose action declares no `eligible` rule. A consumer with no mode system
    // supplies no `getRuleCtx`, and then `allows` stays absent and everything
    // is permitted — which is what every such consumer has always seen.
    const capsCtx = ctx.getRuleCtx?.();
    const allows = capsCtx
      ? (tags: readonly CapabilityTag[]) =>
          tags.every((tag) => capsCtx.allowedCapabilities.has(tag))
      : undefined;
    const view = ctx.viewId ?? null;
    const result: ScopedBinding[] = scopeBindings(ordered, {
      focusedId: ctx.activeToolId,
      engagedIds: new Set(ctx.hotkeyStack),
      ...(allows ? { allows } : {}),
    }).filter((sb) => liveInView(sb.binding, view));

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

  function handleInput(event: InputEvent, ctx: DispatcherContext): 'handled' | 'unhandled' {
    routedView = ctx.viewId;
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
      // A hand is doing one multitouch gesture at a time, but the gesture id
      // carries the finger count — so a finger landing or lifting mid-gesture
      // names a different one. Nothing else ends the handle the hand has left:
      // the seam only ends multitouch when the count drops below two, so a
      // three-to-two transition left the three-finger handle in flight,
      // unpumped, until the final lift committed it alongside the real one.
      for (const [id, other] of [...inFlightHandles]) {
        if (!id.startsWith('multitouch-') || id === gestureId) continue;
        other.onEnd?.(buildInvocationCtx(event, {}, id), 'cancel');
        inFlightHandles.delete(id);
        inFlightOwners.delete(id);
        inFlightActions.delete(id);
        pinchStartSpreads.delete(id);
      }
      // No in-flight handle → fall through to scope assembly + match below.
      // This allows the initial multitouch event (which carries centroid/spread)
      // to start a new ongoing handle on first dispatch.
    }

    const r = rank(event, ctx, DEV);
    const walked = walk(r, event, ctx, (match, action, deps) => invoke(event, match, action, deps), false);
    const outcome: 'handled' | 'unhandled' = walked.stop === 'fired' ? 'handled' : 'unhandled';
    if (DEV) recordTrace(buildRecord(r, walked, event, ctx, false, outcome));
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

  /** One input's candidates, matched, filtered and ranked, before any is asked. */
  interface Ranking {
    /** Every match the claim admitted, best first — ineligible ones
     *  included, in the place they would hold. */
    ordered: MatchResult[];
    /** Matches an exclusive claim barred; collected only when recording. */
    barred: MatchResult[];
    claimOwner?: string;
    actionMap: Map<string, Action>;
    ruleCtx: RuleCtx | undefined;
    /** Whether a match survives the eligibility filter. */
    eligible(m: MatchResult): boolean;
  }

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

  interface Walked {
    /** Survivors of both filters, best first, each with what the walk did. */
    steps: Array<{ match: MatchResult; step: WalkStep }>;
    /** Why the walk ended: a candidate fired (or would), one was misbound, or
     *  every candidate was exhausted. */
    stop: 'fired' | 'misbound' | 'exhausted';
    winner: { match: MatchResult; action: Action } | null;
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

  /** Project a ranking and its walk into a plain {@link DispatchRecord}. */
  function buildRecord(
    r: Ranking,
    walked: Walked,
    event: InputEvent,
    ctx: DispatcherContext,
    predicted: boolean,
    outcome: 'handled' | 'unhandled',
  ): DispatchRecord {
    const view = ctx.viewId ?? null;
    const candidates = new Map<MatchResult, RecordCandidate>();
    const candidateOf = (m: MatchResult): RecordCandidate => {
      let c = candidates.get(m);
      if (!c) {
        const eligible = r.actionMap.get(m.binding.actionId)?.eligible;
        c = {
          actionId: m.binding.actionId,
          routes: routesForSpec(m.binding.spec),
          scope: m.scope,
          ownerId: m.ownerId,
          namesView: namesView(m.binding, view),
          specificity: specificity(m.binding.spec),
          ...(eligible !== undefined ? { eligible: describeEligible(eligible) } : {}),
        };
        candidates.set(m, c);
      }
      return c;
    };
    const dropped: DroppedCandidate[] = [
      ...r.barred.map((m): DroppedCandidate => ({
        candidate: candidateOf(m),
        filter: 'claim',
        ...(r.claimOwner !== undefined ? { owner: r.claimOwner } : {}),
      })),
    ];
    for (const m of r.ordered) {
      if (r.eligible(m)) continue;
      const c = candidateOf(m);
      dropped.push({ candidate: c, filter: 'ineligible', rule: c.eligible ?? '' });
    }
    const gated = (m: MatchResult): boolean =>
      r.actionMap.get(m.binding.actionId)?.eligible !== undefined;
    const ranked: RankedCandidate[] = walked.steps.map(({ match, step }, i) => {
      const prev = walked.steps[i - 1]?.match;
      return {
        candidate: candidateOf(match),
        placedBy: prev ? placedBy(prev, match, view, r.ruleCtx !== undefined && gated(prev) && !gated(match)) : { step: 'first' },
        walk: step,
      };
    });
    const eventKey = event.kind === 'key' || event.kind === 'key-held' ? event.key : undefined;
    const world = worldPointOf(event);
    return {
      kind: 'dispatch',
      ts: Date.now(),
      input: {
        eventKind: event.kind,
        ...(eventKey !== undefined ? { key: eventKey } : {}),
        modifiers: modifiersOf(event),
        viewId: view,
        ...(world !== undefined ? { world } : {}),
        ...(r.ruleCtx !== undefined ? { mode: r.ruleCtx.mode } : {}),
      },
      matched: [...r.ordered, ...r.barred].map(candidateOf),
      dropped,
      ranked,
      predicted,
      fired: walked.winner?.action.id ?? null,
      outcome,
    };
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
    return buildRecord(r, walked, event, ctx, true, walked.winner ? 'handled' : 'unhandled');
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
    // Latest start wins, matching `getActiveAction` — with a mouse and a pen
    // in flight together the cursor belongs to the gesture the user just
    // began, not the one they began first. Map iteration is insertion order
    // and each gestureId is set exactly once, so the last entry is the newest.
    let cursor: string | null = null;
    for (const action of inFlightActions.values()) {
      const c = resolveCursor(action.activeCursor ?? action.cursor);
      if (c) cursor = c;
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
    // The dispatcher can end this handle without the control knowing —
    // `cancelAll` on tool switch, Escape, or unmount. Absence from
    // `inFlightHandles` is that signal; without it a later `end()` would
    // run `onEnd` a second time and commit over an already-cancelled gesture.
    const live = (): boolean => !ended && inFlightHandles.get(gestureId) === handle;
    return {
      gestureId,
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
