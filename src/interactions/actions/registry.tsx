/**
 * @experimental
 * Actions Registry — owns one `keydown` listener per scope and dispatches to
 * registered `Action` descriptors. Spec: docs/superpowers/specs/2026-05-09-actions-registry-design.md
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
import type { GestureSpec } from '../gestures/spec';
import type { BindingOpts, Invoker } from './invoker';
import { useOptionalDepRegistry, type DepRegistry, type DepName } from './depRegistry';

/**
 * @experimental
 * A single entry in `Action.gestureBinding[]`. Either a bare `GestureSpec`
 * (no per-binding opts) or an object form that pairs a spec with
 * `BindingOpts` for parametric actions (e.g. `{ params: { axis: 'x' } }`).
 * Use the object form when two bindings for the same action differ only in
 * a runtime parameter — the dispatcher extracts `opts.params` and passes
 * them to `ImmediateInvoker.run` as its second argument.
 */
export type BoundGesture = GestureSpec | { spec: GestureSpec; opts: BindingOpts };

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
  gestureBinding?: GestureSpec | BoundGesture[];
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
   */
  enabled?: () => true | ActionDisabledReason;
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

/**
 * @internal
 * Safely evaluate an action's `enabled` predicate. Returns `{enabled: true}`
 * when no predicate is supplied. Catches throws and treats them as disabled
 * with reason `'(predicate threw)'`. In dev mode, warns once per action id
 * when a single call exceeds 4ms (single frame at 240fps — generous; real
 * predicates should be sub-millisecond).
 */
const enabledSlowWarned = new Set<string>();
const enabledThrewWarned = new Set<string>();
const ENABLED_BUDGET_MS = 4;
export function evaluateEnabled(action: Action): ActionEnabledResult {
  if (!action.enabled) return { enabled: true };
  const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
  const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? () => performance.now()
    : () => Date.now();
  const start = isDev ? now() : 0;
  try {
    const result = action.enabled();
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
  trigger(id: string): boolean;
  /**
   * Subscribe to registry mutations. The callback fires after any
   * `register`/`unregister` that changes the version. Returns an
   * unsubscribe function. Designed for `useSyncExternalStore`-driven
   * surfaces (e.g. `<ActionBar>` in `@orochi235/weasel-ui`) that need to
   * re-render when the action set changes.
   */
  subscribe(listener: () => void): () => void;
}

const ActionsContext = createContext<ActionsRegistry | null>(null);

/**
 * @experimental
 * Mounts an `ActionsRegistry` and one `document` keydown listener for its
 * lifetime. Children call `useActionsRegistry()` or `useAction()` to participate.
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

  // Phase 14e Task 7: the legacy keystroke loop that walked every action's
  // `defaultBinding: KeyBinding` and matched against keydown is gone. All
  // kit-standard descriptors now route through the gesture dispatcher via
  // `gestureBinding`. Consumer-facing hooks (`useEscape`, `useDelete`, ...)
  // keep their own `useKeybinding` listener (gated by `reg == null` for
  // kit-standard-covered ones; ungated for clipboard which has no kit
  // counterpart).

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
      trigger: (id: string) => {
        const a = actionsRef.current.get(id);
        if (!a) return false;
        try {
          if (a.invoker && a.invoker.timing === 'immediate') {
            // Build a live deps bag from the dep registry (when present);
            // invokers tolerate undefined deps and default to a sensible
            // variant when `params` is undefined (imperative path).
            const r = depRegRef.current;
            const deps = r
              ? {
                  selection: r.get('selection' as DepName),
                  scene: r.get('scene' as DepName),
                  history: r.get('history' as DepName),
                  view: r.get('view' as DepName),
                  pointer: r.get('pointer' as DepName),
                  activeTool: r.get('activeTool' as DepName),
                }
              : {};
            a.invoker.run(deps as never, undefined);
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
    };
  }, []);

  return <ActionsContext.Provider value={registry}>{children}</ActionsContext.Provider>;
}

/**
 * @experimental
 * Returns the parent `ActionsRegistry`, or `null` when no provider is in scope.
 */
export function useActionsRegistry(): ActionsRegistry | null {
  return useContext(ActionsContext);
}

/**
 * @experimental
 * Register an `Action` for the lifetime of the calling component. No-op when
 * no `ActionsProvider` is in scope. Re-registers on `action` reference change
 * (consumers should memoize stable identities to avoid churn).
 */
export function useAction(action: Action): void {
  const reg = useActionsRegistry();
  useEffect(() => {
    if (!reg) return;
    return reg.register(action);
  }, [reg, action]);
}
