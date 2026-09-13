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
import type { BoundGesture } from './binding';
import type { Action } from './action';
import { useOptionalDepRegistry, type DepRegistry, type DepName } from './depRegistry';
import { buildDepsFromRequires } from './buildDeps';
import { RESERVED_ID_NAMES, RESERVED_ID_PREFIXES, type PhaseAtom } from '../../tools/routing/routeGrammar';
import type { Dispatcher, UiOngoingControl } from '../dispatcher/dispatcher';
export type { UiOngoingControl } from '../dispatcher/dispatcher';




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
  /** Add an action and return its release. Registrants for one id stack,
   *  newest live, so releasing yours uncovers whoever you displaced. Call it
   *  from an effect and release it in that effect's cleanup — registering from
   *  a render body pushes an entry per render and releases none. */
  register(action: Action): () => void;
  /** Drop every registrant of `id`. This is the "this action should not exist"
   *  door, not a release — for that, call what `register` returned. */
  unregister(id: string): void;
  /** Declare `id` not for this scope: it stays registered, and every other
   *  scope over the same store still resolves it, but here it lists as absent
   *  and neither `trigger` nor `begin` will fire it. Returns a release; an
   *  `<ActionsScope>` drops what it muted when it unmounts. This is the
   *  "not for me" door — `unregister` is the "should not exist" one. */
  mute(id: string): () => void;
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

/** Everything a registry does apart from muting, which is layered on top of it
 *  once per scope by `useMuted`. */
type ActionsStore = Omit<ActionsRegistry, 'mute'>;

/**
 * Layers a mute set over `base`. Registration, `unregister`, `trigger`'s
 * effects, and the dispatcher / dep-registry slots all pass straight through,
 * so what one scope registers every sibling still sees; only this scope's own
 * reads and invocations skip what it muted.
 */
function useMuted(base: ActionsStore | null): ActionsRegistry | null {
  const mutedRef = useRef<Map<string, number>>(new Map());
  const listenersRef = useRef<Set<() => void>>(new Set());
  const cacheRef = useRef<{ src: readonly Action[]; out: readonly Action[] } | null>(null);

  return useMemo<ActionsRegistry | null>(() => {
    if (!base) return null;
    const isMuted = (id: string): boolean => mutedRef.current.has(id);
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
      ...base,
      list: () => {
        const src = base.list();
        if (mutedRef.current.size === 0) return src;
        const cached = cacheRef.current;
        if (cached && cached.src === src) return cached.out;
        const out = Object.freeze(src.filter((a) => !mutedRef.current.has(a.id)));
        cacheRef.current = { src, out };
        return out;
      },
      trigger: (id, params) => (isMuted(id) ? false : base.trigger(id, params)),
      begin: (id, params) => (isMuted(id) ? null : base.begin(id, params)),
      subscribe: (listener) => {
        const offBase = base.subscribe(listener);
        listenersRef.current.add(listener);
        return () => {
          offBase();
          listenersRef.current.delete(listener);
        };
      },
      mute: (id: string) => {
        mutedRef.current.set(id, (mutedRef.current.get(id) ?? 0) + 1);
        cacheRef.current = null;
        notify();
        let released = false;
        return () => {
          if (released) return;
          released = true;
          const held = mutedRef.current.get(id);
          if (held === undefined) return;
          if (held > 1) mutedRef.current.set(id, held - 1);
          else mutedRef.current.delete(id);
          cacheRef.current = null;
          notify();
        };
      },
    };
  }, [base]);
}

/**
 * @experimental
 * A view of the registry in scope that can declare ids not for itself. Wrap
 * anything that should be able to opt out of an action — a second
 * `<SceneCanvas>` sharing the host's `<ActionsProvider>` mounts one — and its
 * `mute` calls stay inside it. Renders nothing of its own.
 *
 * Not a `BindingScope`: that names the tier a binding matches at (hotkey /
 * active / ambient), which this has nothing to do with.
 */
export function ActionsScope({ children }: { children: ReactNode }): ReactElement {
  const parent = useActionsRegistry();
  const scoped = useMuted(parent);
  if (!scoped) return <>{children}</>;
  return <ActionsContext.Provider value={scoped}>{children}</ActionsContext.Provider>;
}

/**
 * @experimental
 * Mounts an `ActionsRegistry` for its lifetime. Children call
 * `useActionsRegistry()` or `useAction()` to participate. Mounts no input
 * listener of its own — the gesture dispatcher owns input.
 */
export function ActionsProvider({ children }: { children: ReactNode }): ReactElement {
  // A stack of registrants per id, newest live. Two canvases under one provider
  // both register `viewport.zoom`; with a single slot the second displaced the
  // first and its teardown then deleted the entry outright, taking wheel zoom
  // away from the canvas still on screen. Stacking means a displaced registrant
  // is restored when the one above it leaves.
  const actionsRef = useRef<Map<string, Action[]>>(new Map());
  const liveAction = (id: string): Action | undefined => actionsRef.current.get(id)?.at(-1);
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

  const store = useMemo<ActionsStore>(() => {
    const snapshot = (): readonly Action[] => {
      const v = versionRef.current;
      if (cachedVerRef.current === v) return cachedRef.current;
      const out = Object.freeze(
        Array.from(actionsRef.current.values(), (stack) => stack[stack.length - 1]),
      );
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
        const stack = actionsRef.current.get(action.id);
        if (stack) stack.push(action);
        else actionsRef.current.set(action.id, [action]);
        versionRef.current++;
        notify();
        let released = false;
        return () => {
          if (released) return;
          released = true;
          const cur = actionsRef.current.get(action.id);
          if (!cur) return;
          // Our own entry, wherever it now sits: a registrant that was already
          // displaced must take itself out without disturbing the one above it.
          const i = cur.lastIndexOf(action);
          if (i === -1) return;
          cur.splice(i, 1);
          if (cur.length === 0) actionsRef.current.delete(action.id);
          versionRef.current++;
          notify();
        };
      },
      unregister: (id: string) => {
        // Drops every registrant of `id`, not just the live one — this is the
        // "this action should not exist" door, not a release.
        if (actionsRef.current.delete(id)) {
          versionRef.current++;
          notify();
        }
      },
      list: () => snapshot(),
      trigger: (id: string, params?: Record<string, unknown>) => {
        const a = liveAction(id);
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
        const a = liveAction(id);
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

  // The provider is a scope in its own right, so a lone canvas can mute
  // without one wrapped around it.
  const registry = useMuted(store)!;

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
