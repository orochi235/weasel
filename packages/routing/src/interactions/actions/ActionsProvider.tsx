/**
 * @experimental
 * The React half of the actions registry: the context, the tree node that
 * owns each id → descriptor stack, the providers that mount nodes, and the two
 * hooks. The store contract it implements is in `registry.ts`.
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
import {
  useOptionalDepRegistry,
  type DepRegistry,
  type DepName,
} from './depRegistry';
import { buildDepsFromRequires } from './buildDeps';
import type { Dispatcher } from '../dispatcher/dispatcher';
import { validateActionId, validateActionDefaultBinding, type ActionsRegistry } from './registry';
import { pushOwner, ScopeNode } from './scopeNode';

/** @internal Provided by `<ActionsProvider>`, `<InputScope>` and `<Yoke>`. */
export const ActionsContext = createContext<ActionsRegistry | null>(null);

/** The deps an action is invoked with: its declared `requires` when it has
 *  one, the legacy fixed bag otherwise. The fixed bag has no `applyOps`, so an
 *  action that needs the consumer's history must declare it. */
function depsFor(a: Action, r: DepRegistry | null): Record<string, unknown> {
  if (!r) return {};
  if (a.requires) return buildDepsFromRequires(a, r) as Record<string, unknown>;
  return {
    selection: r.get('selection' as DepName),
    scene: r.get('scene' as DepName),
    history: r.get('history' as DepName),
    view: r.get('view' as DepName),
    activeTool: r.get('activeTool' as DepName),
    booleansAdapter: r.get('booleansAdapter' as DepName),
  };
}

/**
 * One node of the actions tree: the actions registered at it, over its
 * parent's. Each id holds a stack of registrants, newest live, so a displaced
 * registrant is restored when the one above it leaves. Every read the registry
 * answers — `list`, `trigger`, `begin` — starts at the node's leaf.
 */
export class ActionsNode extends ScopeNode<ActionsNode> {
  private readonly actions = new Map<string, Action[]>();
  private readonly muted = new Map<string, number>();
  private readonly dispatchers: Dispatcher[] = [];
  private cache: { version: number; leaf: ActionsNode; list: readonly Action[] } | null = null;
  /** Called on `activate`, so a scope's dep and tool nodes move with it. */
  readonly onActivate: (() => void)[] = [];

  constructor(
    parent: ActionsNode | null,
    descends: boolean,
    private readonly contextDeps: () => DepRegistry | null,
  ) {
    super(parent, descends);
    NODES.set(this.registry, this);
  }

  private resolve(id: string): Action | undefined {
    for (const n of this.chain()) {
      if (n.muted.has(id)) return undefined;
      const a = n.actions.get(id)?.at(-1);
      if (a) return a;
    }
    return undefined;
  }

  private snapshot(): readonly Action[] {
    const leaf = this.start();
    const cached = this.cache;
    if (cached && cached.version === this.tree.version && cached.leaf === leaf) return cached.list;
    const ids = new Set<string>();
    for (const n of leaf.chain()) for (const id of n.actions.keys()) ids.add(id);
    const out: Action[] = [];
    for (const id of ids) {
      const a = leaf.resolve(id);
      if (a) out.push(a);
    }
    const list = Object.freeze(out);
    this.cache = { version: this.tree.version, leaf, list };
    return list;
  }

  private deps(): DepRegistry | null {
    for (const n of this.chain()) {
      const r = n.contextDeps();
      if (r) return r;
    }
    return null;
  }

  private dispatcher(): Dispatcher | null {
    for (const n of this.chain()) {
      const d = n.dispatchers.at(-1);
      if (d) return d;
    }
    return null;
  }

  override activate(): void {
    super.activate();
    for (const f of this.onActivate) f();
  }

  readonly registry: ActionsRegistry = {
    register: (action: Action) => {
      validateActionId(action.id);
      validateActionDefaultBinding(action);
      const stack = this.actions.get(action.id);
      if (stack) stack.push(action);
      else this.actions.set(action.id, [action]);
      this.changed();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const cur = this.actions.get(action.id);
        if (!cur) return;
        // Our own entry, wherever it now sits: a registrant that was already
        // displaced must take itself out without disturbing the one above it.
        const i = cur.lastIndexOf(action);
        if (i === -1) return;
        cur.splice(i, 1);
        if (cur.length === 0) this.actions.delete(action.id);
        this.changed();
      };
    },
    unregister: (id: string) => {
      if (this.actions.delete(id)) this.changed();
    },
    mute: (id: string) => {
      this.muted.set(id, (this.muted.get(id) ?? 0) + 1);
      this.changed();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const held = this.muted.get(id);
        if (held === undefined) return;
        if (held > 1) this.muted.set(id, held - 1);
        else this.muted.delete(id);
        this.changed();
      };
    },
    list: () => this.snapshot(),
    trigger: (id: string, params?: Record<string, unknown>) => {
      const leaf = this.start();
      const a = leaf.resolve(id);
      if (!a) return false;
      try {
        if (a.invoker && a.invoker.timing === 'immediate') {
          a.invoker.run(depsFor(a, leaf.deps()) as never, params);
        }
      } catch (err) {
        console.error(`weasel ActionsRegistry: action "${id}" threw`, err);
      }
      return true;
    },
    subscribe: (listener: () => void) => {
      this.tree.listeners.add(listener);
      return () => {
        this.tree.listeners.delete(listener);
      };
    },
    setDispatcher: (d: Dispatcher | null) => pushOwner(this.dispatchers, d),
    begin: (id: string, params?: Record<string, unknown>) => {
      const leaf = this.start();
      const a = leaf.resolve(id);
      const disp = leaf.dispatcher();
      if (!a || !disp) return null;
      return disp.beginUiOngoing(id, depsFor(a, leaf.deps()) as never, params);
    },
    activate: () => this.activate(),
    isActive: () => this.isActive(),
  };
}

const NODES = new WeakMap<ActionsRegistry, ActionsNode>();

/** The tree node behind `registry`, when it is one of ours. */
export function actionsNodeOf(registry: ActionsRegistry | null): ActionsNode | null {
  return registry ? (NODES.get(registry) ?? null) : null;
}

/**
 * @experimental
 * Mounts a root `ActionsRegistry` for its lifetime. Children call
 * `useActionsRegistry()` or `useAction()` to participate. Mounts no input
 * listener of its own — the gesture dispatcher owns input.
 */
export function ActionsProvider({ children }: { children: ReactNode }): ReactElement {
  // `trigger` consults the dep registry in scope, so actions can be fired
  // imperatively from ActionBar / palette callers.
  const depReg = useOptionalDepRegistry();
  const depRegRef = useRef<DepRegistry | null>(depReg);
  depRegRef.current = depReg;
  const node = useMemo(() => new ActionsNode(null, true, () => depRegRef.current), []);
  return <ActionsContext.Provider value={node.registry}>{children}</ActionsContext.Provider>;
}

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

/**
 * @experimental
 * Returns the `ActionsRegistry` in scope, or `null` when there is none.
 */
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
