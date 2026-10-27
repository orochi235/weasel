/**
 * The React half of the actions registry: the context, the tree node that
 * owns each id → descriptor stack, the providers that mount nodes, and the two
 * hooks. The store contract it implements is in `registry.ts`.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { Action } from './action';
import { evaluateEnabled } from './actionEnabled';
import { useLatest } from '@weasel-js/react';
import {
  useOptionalDepRegistry,
  type DepRegistry,
  type DepName,
} from './depRegistry';
import { buildDepsFromRequires } from './buildDeps';
import type { ActionDeps, WorldPoint } from './invoker';
import type { ImmediateParams } from '../dispatcher/inputFacts';
import type { Dispatcher } from '../dispatcher/dispatcher';
import { validateActionId, validateActionDefaultBinding, type ActionsRegistry } from './registry';
import { createMenuHost, type MenuHost } from '../../menus/menuHost';
import { MenuHostContext } from '../../menus/MenuHostContext';
import { pushOwner, ScopeNode } from './scopeNode';
import { tuneAction, tunedParams, type ActionTuning } from './tuning';
import { overrideActionBindings, resolveBindingOverrides, type BindingOverrides, type ResolvedBindingOverrides } from './bindingOverrides';
import { isDev } from '@weasel-js/react';

/** @internal Provided by `<ActionsProvider>`, `<InputScope>` and `<Yoke>`. */
export const ActionsContext = createContext<ActionsRegistry | null>(null);

/** The deps an action is invoked with: its declared `requires` when it has
 *  one, the legacy fixed bag otherwise. The fixed bag has no `applyOps`, so an
 *  action that needs the consumer's history must declare it. */
function depsFor(a: Action, r: DepRegistry | null): ActionDeps {
  if (!r) return {};
  if (a.requires) return buildDepsFromRequires(a, r);
  return {
    selection: r.get('selection' as DepName),
    scene: r.get('scene' as DepName),
    history: r.get('history' as DepName),
    view: r.get('view' as DepName),
    activeTool: r.get('activeTool'),
    booleansAdapter: r.get('booleansAdapter' as DepName),
  } as ActionDeps;
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
  private readonly tunings = new Map<string, ActionTuning[]>();
  private readonly overrides: BindingOverrides[] = [];
  private overrideCache: { version: number; resolved: ResolvedBindingOverrides } | null = null;
  private readonly dispatchers: Dispatcher[] = [];
  private cache: { version: number; leaf: ActionsNode; list: readonly Action[] } | null = null;
  private host: MenuHost | null = null;
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
      if (a) return this.tuned(a);
    }
    return undefined;
  }

  /** Every tuning for `id` from the root down to here, root first. */
  private tuningsOf(id: string): ActionTuning[] {
    const tunings: ActionTuning[] = [];
    for (const n of this.chain()) {
      const stack = n.tunings.get(id);
      if (stack) tunings.unshift(...stack);
    }
    return tunings;
  }

  /** `a` under every tuning for its id from the root down to here. */
  private tuned(a: Action): Action {
    const tunings = this.tuningsOf(a.id);
    return overrideActionBindings(tunings.length ? tuneAction(a, tunings) : a, this.overridesHere());
  }

  /** Every binding override from the root down to here, read into specs. */
  private overridesHere(): ResolvedBindingOverrides {
    const cached = this.overrideCache;
    if (cached && cached.version === this.tree.version) return cached.resolved;
    const maps: BindingOverrides[] = [];
    for (const n of this.chain()) maps.unshift(...n.overrides);
    const resolved = resolveBindingOverrides(maps);
    this.overrideCache = { version: this.tree.version, resolved };
    return resolved;
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

  /** The actions registered at this node itself, live, unmuted and tuned —
   *  none from the scopes below it. */
  ownActions(): readonly Action[] {
    const out: Action[] = [];
    for (const [id, stack] of this.actions) {
      if (stack.length > 0 && !this.muted.has(id)) out.push(this.tuned(stack.at(-1)!));
    }
    return out;
  }

  /** The deps `a` is invoked with from here: the active scope's, which is
   *  what `trigger` and `begin` run it with. */
  depsOf(a: Action): ActionDeps {
    return depsFor(a, this.start().deps());
  }

  /** The menu host of this node's tree, made by its root on first ask. Rows
   *  resolve and run against the active scope, as chrome's `trigger` does. */
  menuHost(): MenuHost {
    const root = [...this.chain()].at(-1)!;
    return root.host ??= createMenuHost({
      actions: () => root.registry.list(),
      depsFor: (a) => root.depsOf(a),
      trigger: (id, params) => root.registry.trigger(id, params),
      activeTool: () => root.start().deps()?.get('activeTool')?.active ?? null,
    });
  }

  private dispatcher(): Dispatcher | null {
    for (const n of this.chain()) {
      const d = n.dispatchers.at(-1);
      if (d) return d;
    }
    return null;
  }

  override activate(): void {
    keyHolder = this;
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
        // An emptied stack holds the id's place in registration order until
        // the tick ends, so a release followed at once by a register — what
        // `useAction` does when its action object changes — keeps its slot.
        if (cur.length === 0) {
          queueMicrotask(() => {
            if (cur.length === 0 && this.actions.get(action.id) === cur) this.actions.delete(action.id);
          });
        }
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
    tune: (id: string, tuning: ActionTuning) => {
      let stack = this.tunings.get(id);
      if (!stack) this.tunings.set(id, (stack = []));
      const release = pushOwner(stack, tuning);
      this.changed();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        release();
        if (stack.length === 0) this.tunings.delete(id);
        this.changed();
      };
    },
    paramsOf: (id: string, given?: Record<string, unknown>) => tunedParams(this.tuningsOf(id), given),
    overrideBindings: (overrides: BindingOverrides) => {
      const release = pushOwner(this.overrides, overrides);
      this.changed();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        release();
        this.changed();
      };
    },
    bindingOverrides: () => this.start().overridesHere(),
    list: () => this.snapshot(),
    trigger: (id: string, params?: Record<string, unknown>) => {
      const leaf = this.start();
      const a = leaf.resolve(id);
      if (!a?.invoker || a.invoker.timing !== 'immediate') return false;
      const deps = leaf.depsOf(a);
      if (!evaluateEnabled(a, deps, pointOf(params)).enabled) return false;
      try {
        if (a.invoker.run(deps, params) === 'pass') return false;
      } catch (err) {
        console.error(`weasel ActionsRegistry: action "${id}" threw`, err);
      }
      return true;
    },
    preview: (id: string, params?: Record<string, unknown>) => {
      const leaf = this.start();
      const a = leaf.resolve(id);
      if (!a?.preview) return NO_PREVIEW;
      const deps = leaf.depsOf(a);
      if (!evaluateEnabled(a, deps, pointOf(params)).enabled) return NO_PREVIEW;
      let stop: (() => void) | void;
      try {
        stop = a.preview(deps, params);
      } catch (err) {
        console.error(`weasel ActionsRegistry: preview of "${id}" threw`, err);
        return NO_PREVIEW;
      }
      if (typeof stop !== 'function') return NO_PREVIEW;
      let down = false;
      return () => {
        if (down) return;
        down = true;
        try {
          stop();
        } catch (err) {
          console.error(`weasel ActionsRegistry: preview of "${id}" threw as it ended`, err);
        }
      };
    },
    subscribe: (listener: () => void) => this.tree.listeners.subscribe(listener),
    setDispatcher: (d: Dispatcher | null) => pushOwner(this.dispatchers, d),
    begin: (id: string, params?: Record<string, unknown>) => {
      const leaf = this.start();
      const a = leaf.resolve(id);
      const disp = leaf.dispatcher();
      if (!a || !disp) return null;
      return disp.beginUiOngoing(id, leaf.depsOf(a), params);
    },
    activate: () => this.activate(),
    isActive: () => this.isActive(),
    holdsKeys: () => keyHolder === this,
    dropKeys: () => { if (keyHolder === this) keyHolder = null; },
  };
}

const NO_PREVIEW = (): void => {};

/** The world point a trigger's params carry, if any. */
function pointOf(params: Record<string, unknown> | undefined): WorldPoint | undefined {
  return (params as ImmediateParams | undefined)?.world;
}

/** The node last activated on the page, across every tree: where a key that
 *  reaches the page goes. Null until something is pressed or scrolled in. */
let keyHolder: ActionsNode | null = null;

const NODES = new WeakMap<ActionsRegistry, ActionsNode>();

/** The tree node behind `registry`, when it is one of ours. */
export function actionsNodeOf(registry: ActionsRegistry | null): ActionsNode | null {
  return registry ? (NODES.get(registry) ?? null) : null;
}

/**
 * Mounts a root `ActionsRegistry` for its lifetime. Children call
 * `useActionsRegistry()` or `useAction()` to participate. Mounts no input
 * listener of its own — the gesture dispatcher owns input.
 */
export function ActionsProvider({ children }: { children: ReactNode }): ReactElement {
  // `trigger` consults the dep registry in scope, so actions can be fired
  // imperatively from ActionBar / palette callers.
  const depReg = useOptionalDepRegistry();
  const depRegRef = useLatest<DepRegistry | null>(depReg);
  const node = useMemo(() => new ActionsNode(null, true, () => depRegRef.current), [depRegRef]);
  return (
    <ActionsContext.Provider value={node.registry}>
      <MenuHostContext.Provider value={node.menuHost()}>{children}</MenuHostContext.Provider>
    </ActionsContext.Provider>
  );
}

const IS_DEV = isDev();

/**
 * Returns the `ActionsRegistry` in scope, or `null` when there is none.
 */
export function useActionsRegistry(): ActionsRegistry | null {
  return useContext(ActionsContext);
}

/**
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
