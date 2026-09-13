/**
 * @experimental
 * The React half of the actions registry: the context, the provider that owns
 * the id → descriptor stack, the mute scope, and the two hooks. The store
 * contract it implements is in `registry.tsx`.
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
import type { Action } from './action';
import { useOptionalDepRegistry, type DepRegistry, type DepName } from './depRegistry';
import { buildDepsFromRequires } from './buildDeps';
import type { Dispatcher } from '../dispatcher/dispatcher';
import { validateActionId, validateActionDefaultBinding, type ActionsRegistry } from './registry';


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
/**
 * Push `value` onto an owner stack and hand back its release.
 *
 * Newest wins, but the release takes out *its own* entry wherever it now sits,
 * so a displaced owner leaving cannot disturb the one above it and the owner
 * on top leaving uncovers the one below rather than emptying the stack. A
 * `null` value registers nothing and releases to a no-op. Double-release safe.
 */
function pushOwner<T>(ref: { current: T[] }, value: T | null): () => void {
  if (value === null) return () => {};
  ref.current.push(value);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const i = ref.current.lastIndexOf(value);
    if (i !== -1) ref.current.splice(i, 1);
  };
}

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
  //
  // A stack, newest live, for the same reason the registrant stacks above are:
  // two canvases under one provider both wire themselves, and with a single
  // slot whichever one unmounts empties it — taking the wiring away from the
  // canvas still on screen. The dispatcher ref below is the same story.
  const wiredDepRegRef = useRef<DepRegistry[]>([]);

  // Dispatcher stack — wired from SceneCanvas via setDispatcher so that
  // begin() can delegate to beginUiOngoing.
  const dispatcherRef = useRef<Dispatcher[]>([]);

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
            const r = wiredDepRegRef.current.at(-1) ?? depRegRef.current;
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
        if (d && dispatcherRef.current.length > 0 && dispatcherRef.current.at(-1) !== d
            && !warnedRef.current) {
          warnedRef.current = true;
          warnSharedScope();
        }
        return pushOwner(dispatcherRef, d);
      },
      setDepRegistry: (r: DepRegistry | null) => pushOwner(wiredDepRegRef, r),
      begin: (id: string, params?: Record<string, unknown>) => {
        const disp = dispatcherRef.current.at(-1) ?? null;
        if (!disp) return null;
        const r = wiredDepRegRef.current.at(-1) ?? depRegRef.current;
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
