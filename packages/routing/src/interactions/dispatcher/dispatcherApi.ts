/**
 * The dispatcher's contract: what a host hands it per input
 * (`DispatcherContext`) and what it answers with (`Dispatcher`).
 * `createDispatcher` in `dispatcher.ts` implements it.
 */
import type { CursorSpec } from '@weasel-js/cursor';
import type { Contribution } from '../../contributions/types';
import type { RuleCtx } from '../../eligibility';
import type { Action, ActionSource } from '../actions/action';
import type { GestureBinding } from '../actions/binding';
import type { DepRegistry } from '../actions/depNode';
import type { ActionDeps, OngoingHandle } from '../actions/invoker';
import type { DispatchRecord } from './dispatchRecord';
import type { BindingScope, InputEvent } from './matcher';

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

/**
 * Handle returned by `Dispatcher.beginUiOngoing()` for driving an
 * ongoing invoker from a UI control (color picker, slider).
 *
 *  - `update(params)` rebuilds an `InvocationCtx` with the new params and
 *    calls the handle's `onMove`. Safe to call many times.
 *  - `end(reason)` calls `onEnd(ctx, reason)` once and removes the handle
 *    from the in-flight map. Idempotent — further calls are no-ops.
 *  - `active` is false once the handle has ended, whether through `end` or
 *    by the dispatcher (`cancelAll`, or a later `beginUiOngoing` for the same
 *    action). `update` and `end` do nothing from then on.
 */
export interface UiOngoingControl {
  readonly gestureId: string;
  readonly active: boolean;
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
   * Cursor for the gesture currently in flight, as declared, or `null` when nothing
   * is. Reads `Action.activeCursor` (falling back to `Action.cursor`) off the
   * action whose handle is open — the hover pump applies this instead of its
   * prediction once a gesture starts, which is how `grab` becomes `grabbing`.
   */
  inFlightCursor(): CursorSpec | null;

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
   * cancel-all — and after any other input handled while a gesture is in
   * flight. Input that arrives with nothing in flight and starts nothing
   * does not fire it. Consumers re-read `getInFlightHandles()` and re-render.
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
   * mean no gesture was in flight in between; it does **not** guarantee that
   * a bump changed anything observable (input that matched no binding still
   * counts while a gesture is in flight — see `subscribe`).
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
