/**
 * @experimental
 * Actions Registry — owns the registered `Action` descriptors and the
 * imperative `trigger` path. Keystrokes reach actions through the gesture
 * dispatcher matching their `defaultBinding`, not through a listener here.
 * Spec: docs/superpowers/specs/2026-05-09-actions-registry-design.md
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { GestureSpec, PhaseSpec } from '../gestures/spec';
import type { ActionDeps, BindingOpts, Invoker } from './invoker';
import type { GestureBinding } from './binding';
import { useOptionalDepRegistry, type DepRegistry, type DepName } from './depRegistry';
import { buildDepsFromRequires } from './buildDeps';
import { RESERVED_ID_NAMES, RESERVED_ID_PREFIXES, type PhaseAtom } from '../../tools/routing/routeGrammar';
import type { Dispatcher, UiOngoingControl } from '../dispatcher/dispatcher';
import type { CursorSpec } from '@weasel-js/cursor';
export type { UiOngoingControl } from '../dispatcher/dispatcher';

/**
 * @experimental
 * A single entry in `Action.defaultBinding[]`. Either a bare `GestureSpec`
 * (no per-binding opts) or an object form that pairs a spec with
 * `BindingOpts` for parametric actions (e.g. `{ params: { axis: 'x' } }`).
 * Use the object form when two bindings for the same action differ only in
 * a runtime parameter — the dispatcher extracts `opts.params` and passes
 * them to `ImmediateInvoker.run` as its second argument.
 */
export type BoundGesture = GestureSpec | { spec: GestureSpec; opts: BindingOpts };

/**
 * @experimental
 * Flatten an action's `defaultBinding` into `GestureBinding`s. A bare
 * `GestureSpec` has `kind` at top level; the object form has `spec`.
 */
export function actionBindings(action: Action): GestureBinding[] {
  const gs = action.defaultBinding;
  if (!gs) return [];
  const raw: BoundGesture[] = Array.isArray(gs) ? gs : [gs as BoundGesture];
  return raw.map((entry) => {
    const isBoundObj = !('kind' in entry);
    const spec = isBoundObj ? (entry as { spec: GestureSpec }).spec : (entry as GestureSpec);
    const opts = isBoundObj ? (entry as { opts: BindingOpts }).opts : undefined;
    return { spec, actionId: action.id, ...(opts !== undefined ? { opts } : {}) };
  });
}

/**
 * @experimental
 * Single registered action. v1: one binding per action.
 */
export interface Action {
  id: string;
  label: string;
  /** The gesture-spec form of the binding, read by the gesture dispatcher.
   *  May be a single `GestureSpec`, a bare `GestureSpec[]` (any-of semantics),
   *  or a `BoundGesture[]` where each entry is either a bare `GestureSpec` or
   *  `{ spec, opts }` — use the object form for parametric actions where two
   *  bindings for the same action differ only by `opts.params` (e.g. `flip`
   *  with `axis: 'x'` vs `'y'`). The dispatcher extracts `opts.params` and
   *  passes them to `ImmediateInvoker.run` as its second argument. */
  defaultBinding?: GestureSpec | BoundGesture[];
  /** Names of the deps this action's invoker reads (keys of `DepSchema`).
   *  The dispatcher (and `trigger`, when `requires` is present) resolves
   *  each name against the `DepRegistry` at invocation time and passes the
   *  resulting bag to the invoker. Dev builds warn when the invoker reads a
   *  dep it didn't declare here — see `buildDepsFromRequires`. */
  requires?: readonly DepName[];
  /** Inline-SVG icon for palette / toolbar surfaces. Mirrors
   *  `ToolPresentation.icon` so a generic `<ActionBar>` can render from
   *  action metadata the same way `<ToolPalette>` renders from tool
   *  metadata. May be a static `ReactNode` or a function (rare; useful
   *  for state-aware icons like a "lock" toggle). */
  icon?: ReactNode | (() => ReactNode);
  /** Grouping key for palette/menu surfaces. Free-form string; the kit
   *  ships defaults for `'align'` (six edges/centers), `'distribute'`
   *  (two axes), and recommends `'pathfinder'` for boolean ops. */
  group?: string;
  /** Display override for the keyboard shortcut. When omitted, palette
   *  surfaces derive a label from `defaultBinding` via their own
   *  formatter. */
  shortcut?: string;
  /** Pluggable invocation strategy. The gesture dispatcher routes matched
   *  bindings through `invoker.start` / `invoker.run` depending on timing.
   *  All kit-standard descriptors ship one; consumer-supplied actions
   *  without an invoker can still register but won't be triggered. */
  invoker?: Invoker;
  /** When set to `'hotkey'`, this action's `defaultBinding` rides the hotkey
   *  `BindingScope` instead of the ambient scope — meaning it beats any
   *  active-tool binding on the same input shape. Use for tool-switch
   *  shortcuts and global held-key triggers. Default: ambient. */
  scope?: 'hotkey';
  /**
   * @experimental
   * Optional predicate the command palette consults when rendering. Return
   * `true` when the action is currently triggerable. Return a reason string
   * (e.g. `'Selection required'`) when disabled — the palette greys out
   * the row, skips it in keyboard nav, ignores clicks, and shows the
   * reason next to the label. Keystroke dispatch (the registered binding)
   * is unaffected; the action's own `run` should self-guard.
   *
   * **Contract:** must be pure (no side effects), fast (< 4ms in dev), and
   * must not throw. If a call throws or exceeds the budget in dev mode,
   * `evaluateEnabled` logs a one-time warning per action id; throws are
   * caught and treated as disabled with reason `'(predicate threw)'`.
   *
   * Snapshot-on-open semantics: the palette evaluates `enabled` once when
   * opened and does NOT re-evaluate on selection changes while open. Live
   * reactive updates are deferred — palette is short-lived.
   *
   * The reason set is a closed enum — to add a new reason, edit
   * `ActionDisabledReason` and the consumer's display map.
   *
   * The optional `deps` argument is the same bag passed to
   * `ImmediateInvoker.run`; callers (`evaluateEnabled` / the ActionBar) may
   * synthesize it from the surrounding `DepRegistry` so predicates can
   * inspect selection / scene / etc. Predicates that don't need deps just
   * ignore the arg.
   */
  enabled?: (deps?: ActionDeps) => true | ActionDisabledReason;
  /**
   * Declarative eligibility rule, evaluated against the current
   * `RuleCtx` by the dispatcher before invoking `start()`. Omitted =
   * always eligible.
   *
   * Accepts either a fluent `Condition` (callable with `.rule`) or a
   * raw `Rule` tree; the dispatcher normalizes via `.rule` unwrap.
   *
   * Prefer `capability:`-based rules (e.g. `{ capability: 'transforms-selection' }`)
   * over `mode:` rules — capability rules survive new modes being added
   * that allow the same capability.
   */
  eligible?:
    | import('../../features/chrome-caps').Rule
    | import('../../features/chrome-caps').Condition;
  /**
   * CSS cursor shown while the pointer hovers a spot where this action
   * would win the drag. The hover-cursor pump (in `useGestureDispatcher`)
   * runs `Dispatcher.resolveOnly` on each idle pointermove — the same
   * match walk a real pointerdown takes — and applies the winning
   * action's `cursor`, so the hint and the actual click target stay in
   * sync by construction. Omitted = no override (the active tool's
   * `Tool.cursor` shows). Affordance hits are resolved earlier in the
   * pump via `AffordanceRegion.cursor` and never reach this field.
   *
   * Static value only. Prediction runs `enabled()` but cannot run the
   * invoker, so an action that matches yet bails at `start()` (empty
   * handle) may still show its cursor — keep `enabled` accurate for
   * actions that declare one.
   */
  cursor?: CursorSpec;
  /**
   * CSS cursor shown while THIS action's ongoing handle is in flight —
   * grabbing while panning, `move` while dragging a selection, `crosshair`
   * while pulling a marquee.
   *
   * Separate from `cursor` because the two answer different questions:
   * `cursor` is a prediction ("a drag from here would pan"), this is a state
   * ("you are panning"). An action can declare either, both, or neither;
   * with only `cursor` set, the hover hint holds for the duration of the
   * gesture.
   *
   * This is where mid-gesture cursors live now. They used to come from the
   * tool side — `ViewportToolDef.engaged.cursor` for a phase-gated string,
   * or a function-form `Tool.cursor` reading the gesture scratch out of the
   * tool-routing dispatcher. Both belonged to a pipeline whose whole job was
   * being taken over by bindings, and neither could describe a cursor for an
   * action a tool doesn't own.
   */
  activeCursor?: CursorSpec;
}

/**
 * @experimental
 * Closed enum of reasons an action might report itself as disabled. The
 * consumer (palette, menu, etc.) maps these symbolic values to display
 * strings via its own label map — see `demo/CommandPalette.tsx` for the
 * canonical mapping.
 */
export const ActionDisabledReason = {
  SelectionRequired: 'selection-required',
  SceneEmpty: 'scene-empty',
  NotApplicable: 'not-applicable',
  /** Sentinel: the predicate threw. Surfaced by `evaluateEnabled`'s catch. */
  PredicateThrew: 'predicate-threw',
} as const;
/** Why an action is unavailable right now. */
export type ActionDisabledReason =
  (typeof ActionDisabledReason)[keyof typeof ActionDisabledReason];

/**
 * @experimental
 * Result of evaluating an Action's `enabled` predicate.
 */
export interface ActionEnabledResult {
  enabled: boolean;
  reason?: ActionDisabledReason;
}

const enabledSlowWarned = new Set<string>();
const enabledThrewWarned = new Set<string>();
const ENABLED_BUDGET_MS = 4;
/**
 * @experimental
 * Safely evaluate an action's `enabled` predicate. Returns `{enabled: true}`
 * when no predicate is supplied. Catches throws and treats them as disabled
 * with reason `'(predicate threw)'`. In dev mode, warns once per action id
 * when a single call exceeds 4ms (single frame at 240fps — generous; real
 * predicates should be sub-millisecond).
 */
export function evaluateEnabled(
  action: Action,
  deps?: ActionDeps,
): ActionEnabledResult {
  if (!action.enabled) return { enabled: true };
  const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
  const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? () => performance.now()
    : () => Date.now();
  const start = isDev ? now() : 0;
  try {
    const result = action.enabled(deps);
    if (isDev) {
      const elapsed = now() - start;
      if (elapsed > ENABLED_BUDGET_MS && !enabledSlowWarned.has(action.id)) {
        enabledSlowWarned.add(action.id);
        console.warn(
          `weasel actions: enabled() for action "${action.id}" took ${elapsed.toFixed(2)}ms ` +
          `(budget ${ENABLED_BUDGET_MS}ms). The predicate must be pure and fast — see Action.enabled JSDoc.`,
        );
      }
    }
    if (result === true) return { enabled: true };
    return { enabled: false, reason: result };
  } catch (e) {
    if (isDev && !enabledThrewWarned.has(action.id)) {
      enabledThrewWarned.add(action.id);
      console.warn(
        `weasel actions: enabled() for action "${action.id}" threw; treating as disabled. ` +
        `The predicate must not throw — see Action.enabled JSDoc.`,
        e,
      );
    }
    return { enabled: false, reason: ActionDisabledReason.PredicateThrew };
  }
}

/** @internal Test helper: reset warn-once dedup so tests can repro-fire warnings. */
export function _resetEnabledWarnsForTests(): void {
  enabledSlowWarned.clear();
  enabledThrewWarned.clear();
}

/**
 * @experimental
 * Partial override or full descriptor passed via `<SceneCanvas actions={...}>`.
 * `null` disables a default at this id.
 */
export type ActionEntry = null | Partial<Action> | Action;

/**
 * @experimental
 * Shape of the `actions` prop on `<SceneCanvas>`. `null` disables all defaults.
 */
export type ActionsProp = null | Record<string, ActionEntry>;

/**
 * @experimental
 * Imperative API exposed by `useActionsRegistry()`.
 */
export interface ActionsRegistry {
  register(action: Action): () => void;
  unregister(id: string): void;
  list(): readonly Action[];
  /** Fire an immediate-invoker action by id. The optional `params` arg is
   *  forwarded to `ImmediateInvoker.run` as its second argument — use it for
   *  parametric actions (e.g. `trigger('tool.activate', { toolId: 'rect' })`).
   *  Ongoing-invoker actions are not reachable from `trigger`. */
  trigger(id: string, params?: Record<string, unknown>): boolean;
  /**
   * Subscribe to registry mutations. The callback fires after any
   * `register`/`unregister` that changes the version. Returns an
   * unsubscribe function. Designed for `useSyncExternalStore`-driven
   * surfaces (e.g. `<ActionBar>` in `@weasel-js/ui`) that need to
   * re-render when the action set changes.
   */
  subscribe(listener: () => void): () => void;

  /**
   * Start an ongoing action driven by UI (color picker, opacity slider).
   * Returns a control object with `update(params)` and `end(reason)`.
   *
   * Returns `null` if no dispatcher is wired into this registry, the
   * action is unknown, or its invoker is not ongoing.
   *
   * See `Dispatcher.beginUiOngoing` for full semantics including
   * auto-commit when a prior UI handle for the same action is in flight.
   */
  begin(id: string, params?: Record<string, unknown>): UiOngoingControl | null;

  /** Wire a dispatcher into the registry so `begin()` can delegate to it.
   *  Returns a release that clears the slot only while this dispatcher still
   *  holds it: a canvas displaced by a later one must not take input away from
   *  the canvas now on screen. Call with `null` to detach unconditionally. */
  setDispatcher(d: Dispatcher | null): () => void;

  /** Wire a `DepRegistry` into the registry so `trigger()` / `begin()` can
   *  resolve action deps even when this provider is mounted ABOVE the dep
   *  registry (e.g. a consumer's root `<ActionsProvider>` reused by
   *  SceneCanvas's `ActionsProviderIfRoot`). Takes precedence over the dep
   *  registry read from context at the provider's own level. Call with
   *  `null` to detach unconditionally; the returned release clears the slot
   *  only while this registry still holds it. */
  setDepRegistry(r: DepRegistry | null): () => void;
}

// ─── Registration-time validation ─────────────────────────────────────────

/** Validate that `id` is usable as an action id in the route grammar.
 *  Rejects ids that start with a reserved sigil (would shadow future
 *  grammar extensions) and ids that collide with phase keywords (would
 *  parse as the bare-phase shorthand). Mirrors `defineTool`'s tool-id
 *  validation. */
function validateActionId(id: string): void {
  if (id.length === 0) {
    throw new Error(`weasel: action id may not be empty`);
  }
  if (RESERVED_ID_PREFIXES.has(id[0]!)) {
    throw new Error(
      `weasel: action id "${id}" starts with reserved sigil "${id[0]}" ` +
      `(reserved set: ${[...RESERVED_ID_PREFIXES].join(' ')})`,
    );
  }
  if (RESERVED_ID_NAMES.has(id)) {
    throw new Error(
      `weasel: action id "${id}" collides with a reserved phase keyword ` +
      `(reserved: ${[...RESERVED_ID_NAMES].join(', ')})`,
    );
  }
}

/** Reject any '&'-channel phase atom in an Action's defaultBinding —
 *  actions have no owning tool, so '&' can't resolve. Tool-side bindings
 *  (Tool.bindings) are the right place for '&' atoms. */
function validateActionDefaultBinding(action: Action): void {
  const gs = action.defaultBinding;
  if (!gs) return;
  const entries: BoundGesture[] = Array.isArray(gs) ? gs : [gs as BoundGesture];
  for (const entry of entries) {
    const spec = ('kind' in entry ? entry : entry.spec) as GestureSpec;
    const phase: PhaseSpec | undefined = spec.phase;
    if (phase === undefined) continue;
    const atoms: readonly PhaseAtom[] = Array.isArray(phase)
      ? phase
      : [{ channel: '&', phase: phase }];
    for (const atom of atoms) {
      if (atom.channel === '&') {
        throw new Error(
          `weasel: action "${action.id}" defaultBinding uses '&' channel ` +
          `which has no owning tool to resolve to. Use a named tool channel ` +
          `(e.g. '[rect:engaged]') or '*' instead, or move this binding to ` +
          `the tool's own Tool.bindings.`,
        );
      }
    }
  }
}

/**
 * A second `<SceneCanvas>` claiming one registry leaves the first unable to
 * dispatch anything, and the symptom — a canvas that stops responding — names
 * neither canvas nor the registry they share.
 */
function warnSharedScope(): void {
  if (!IS_DEV) return;
  console.warn(
    'weasel: a second dispatcher claimed this <ActionsProvider>, so only the ' +
    'newest <SceneCanvas> under it will respond to input. Give each canvas its ' +
    'own scope with <WeaselProvider isolate>.',
  );
}

const ActionsContext = createContext<ActionsRegistry | null>(null);

/**
 * @experimental
 * Mounts an `ActionsRegistry` for its lifetime. Children call
 * `useActionsRegistry()` or `useAction()` to participate. Mounts no input
 * listener of its own — the gesture dispatcher owns input.
 */
export function ActionsProvider({ children }: { children: ReactNode }): ReactElement {
  const actionsRef = useRef<Map<string, Action>>(new Map());
  const versionRef = useRef(0);
  const cachedRef = useRef<readonly Action[]>([]);
  const cachedVerRef = useRef(-1);
  const listenersRef = useRef<Set<() => void>>(new Set());

  // Trigger() consults the optional dep registry so actions can be fired
  // imperatively from ActionBar / palette callers — the registered
  // `invoker.run` receives a deps bag built fresh from the registry.
  const depReg = useOptionalDepRegistry();
  const depRegRef = useRef<DepRegistry | null>(depReg);
  depRegRef.current = depReg;

  // One warning per registry: the message is about the scope, not about which
  // canvas lost, and a page of canvases would otherwise repeat it per mount.
  const warnedRef = useRef(false);

  // Dep registry wired via setDepRegistry — set by SceneCanvas's registrar
  // when this provider sits above the dep-registry scope (consumer root
  // <ActionsProvider>). Preferred over the context read above.
  const wiredDepRegRef = useRef<DepRegistry | null>(null);

  // Dispatcher ref — wired from SceneCanvas via setDispatcher so that
  // begin() can delegate to beginUiOngoing.
  const dispatcherRef = useRef<Dispatcher | null>(null);

  // The legacy keystroke loop that walked every action's
  // `defaultBinding: KeyBinding` and matched against keydown is gone, along
  // with the per-action consumer hooks (`useEscape`, `useDelete`, ...) that
  // carried their own `useKeybinding` listener. Every kit-standard descriptor
  // now routes through the gesture dispatcher via `defaultBinding`.

  const registry = useMemo<ActionsRegistry>(() => {
    const snapshot = (): readonly Action[] => {
      const v = versionRef.current;
      if (cachedVerRef.current === v) return cachedRef.current;
      const out = Object.freeze(Array.from(actionsRef.current.values()));
      cachedRef.current = out;
      cachedVerRef.current = v;
      return out;
    };
    const notify = (): void => {
      for (const l of listenersRef.current) {
        try {
          l();
        } catch (err) {
          console.error('weasel ActionsRegistry: subscriber threw', err);
        }
      }
    };
    return {
      register: (action: Action) => {
        validateActionId(action.id);
        validateActionDefaultBinding(action);
        actionsRef.current.set(action.id, action);
        versionRef.current++;
        notify();
        return () => {
          const cur = actionsRef.current.get(action.id);
          // Only unregister if the current entry is still us (last-writer-wins
          // means a later registrant should not be clobbered by our cleanup).
          if (cur === action) {
            actionsRef.current.delete(action.id);
            versionRef.current++;
            notify();
          }
        };
      },
      unregister: (id: string) => {
        if (actionsRef.current.delete(id)) {
          versionRef.current++;
          notify();
        }
      },
      list: () => snapshot(),
      trigger: (id: string, params?: Record<string, unknown>) => {
        const a = actionsRef.current.get(id);
        if (!a) return false;
        try {
          if (a.invoker && a.invoker.timing === 'immediate') {
            const r = wiredDepRegRef.current ?? depRegRef.current;
            // Prefer the action's declared `requires` (same contract the
            // dispatcher uses — shared `buildDepsFromRequires`, including
            // the dev-mode undeclared-read guard); legacy fixed bag
            // otherwise.
            const deps = !r
              ? {}
              : a.requires
                ? buildDepsFromRequires(a, r)
                : {
                    selection: r.get('selection' as DepName),
                    scene: r.get('scene' as DepName),
                    history: r.get('history' as DepName),
                    view: r.get('view' as DepName),
                    pointer: r.get('pointer' as DepName),
                    activeTool: r.get('activeTool' as DepName),
                    booleansAdapter: r.get('booleansAdapter' as DepName),
                  };
            a.invoker.run(deps as never, params);
          }
        } catch (err) {
          console.error(`weasel ActionsRegistry: action "${id}" threw`, err);
        }
        return true;
      },
      subscribe: (listener: () => void) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
      setDispatcher: (d: Dispatcher | null) => {
        if (d && dispatcherRef.current && dispatcherRef.current !== d && !warnedRef.current) {
          warnedRef.current = true;
          warnSharedScope();
        }
        dispatcherRef.current = d;
        return () => { if (dispatcherRef.current === d) dispatcherRef.current = null; };
      },
      setDepRegistry: (r: DepRegistry | null) => {
        wiredDepRegRef.current = r;
        return () => { if (wiredDepRegRef.current === r) wiredDepRegRef.current = null; };
      },
      begin: (id: string, params?: Record<string, unknown>) => {
        const disp = dispatcherRef.current;
        if (!disp) return null;
        const r = wiredDepRegRef.current ?? depRegRef.current;
        const a = actionsRef.current.get(id);
        // Same resolution order as `trigger`: the action's declared `requires`
        // when it has one, the legacy fixed bag otherwise. The fixed bag has no
        // `applyOps`, so the paint actions — which declare it and are the only
        // callers of `begin` — used to fall back to the scene's own history
        // instead of the consumer's.
        const deps = !r
          ? {}
          : a?.requires
            ? buildDepsFromRequires(a, r)
            : {
                selection: r.get('selection' as DepName),
                scene: r.get('scene' as DepName),
                history: r.get('history' as DepName),
                view: r.get('view' as DepName),
                pointer: r.get('pointer' as DepName),
                activeTool: r.get('activeTool' as DepName),
                booleansAdapter: r.get('booleansAdapter' as DepName),
              };
        return disp.beginUiOngoing(id, deps as never, params);
      },
    };
  }, []);

  return <ActionsContext.Provider value={registry}>{children}</ActionsContext.Provider>;
}

/**
 * @experimental
 * Returns the parent `ActionsRegistry`, or `null` when no provider is in scope.
 */
/**
 * `import.meta.env.DEV` read through a cast — core must not depend on a
 * bundler's ambient augmentation (`vite/client`) to compile. Mirrors the same
 * cast in SceneCanvas.tsx, dispatcher.ts and buildDeps.ts.
 */
const IS_DEV: boolean = (() => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
})();

export function useActionsRegistry(): ActionsRegistry | null {
  return useContext(ActionsContext);
}

/**
 * @experimental
 * Register an `Action` for the lifetime of the calling component. No-op (with
 * a dev-only warning) when no `ActionsProvider` is in scope. Re-registers on
 * `action` reference change (consumers should memoize stable identities to
 * avoid churn).
 */
export function useAction(action: Action): void {
  const reg = useActionsRegistry();
  useEffect(() => {
    if (!reg) {
      if (IS_DEV) {
        console.warn(
          `useAction("${action.id}"): no <ActionsProvider> is in scope, so the action was not registered and its bindings will never fire.`,
        );
      }
      return;
    }
    return reg.register(action);
  }, [reg, action]);
}
