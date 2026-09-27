/**
 * @experimental
 * Input scopes and yokes: the tiers between a root registry and a canvas.
 * Design: docs/proposals/2026-09-27-input-scopes.md.
 */
import { useContext, useEffect, useMemo, type ReactElement, type ReactNode } from 'react';
import { ActionsContext, ActionsNode, actionsNodeOf, useActionsRegistry } from './ActionsProvider';
import { DepNode, DepRegistryContext, depNodeOf, useOptionalDepRegistry } from './depRegistry';
import { ActiveToolNodeContext, ToolNode } from './activeToolContext';

/**
 * @experimental
 * Canvases that share input on purpose: the active tool, the gesture in
 * flight, history and yoke-wide actions. Made once with `useYoke()` where the
 * sharing is decided, and passed to each canvas that joins it (`yoke={yoke}`)
 * and to `<Yoke value={yoke}>` around anything else that should reach it — a
 * toolbar, say. The members can sit anywhere in the tree: the handle, not the
 * tree, says who shares.
 */
export interface Yoke {
  /** @internal */
  readonly actions: ActionsNode;
  /** @internal */
  readonly deps: DepNode;
  /** @internal */
  readonly tools: ToolNode;
}

/** The three nodes of a tier, under `parent`'s or the ones in scope, with
 *  activation carried across all three. */
function useNodes(
  descends: boolean,
  ownsTool: boolean,
  parent: Yoke | undefined,
): Yoke {
  const parentActions = useActionsRegistry();
  const parentDeps = useOptionalDepRegistry();
  const parentTools = useContext(ActiveToolNodeContext);
  const pa = parent ? parent.actions : actionsNodeOf(parentActions);
  const pd = parent ? parent.deps : depNodeOf(parentDeps);
  const pt = parent ? parent.tools : parentTools;
  const nodes = useMemo<Yoke>(() => {
    const deps = new DepNode(pd, descends);
    const tools = new ToolNode(pt, descends, ownsTool, null);
    const actions = new ActionsNode(pa, descends, () => deps.registry);
    actions.onActivate.push(() => deps.activate(), () => tools.activate());
    return { actions, deps, tools };
  }, [pa, pd, pt, descends, ownsTool]);
  useEffect(() => {
    const leave = [nodes.deps.mount(), nodes.tools.mount(), nodes.actions.mount()];
    return () => {
      for (const f of leave) f();
    };
  }, [nodes]);
  return nodes;
}

function Provide({ nodes, children }: { nodes: Yoke; children: ReactNode }): ReactElement {
  return (
    <DepRegistryContext.Provider value={nodes.deps.registry}>
      <ActionsContext.Provider value={nodes.actions.registry}>
        <ActiveToolNodeContext.Provider value={nodes.tools}>{children}</ActiveToolNodeContext.Provider>
      </ActionsContext.Provider>
    </DepRegistryContext.Provider>
  );
}

/** Props for `<InputScope>`. */
export interface InputScopeProps {
  /** The yoke this scope joins. Omitted, it sits under the registries in
   *  scope and keeps a tool of its own. */
  yoke?: Yoke;
  children: ReactNode;
}

/**
 * @experimental
 * One canvas's input: actions, deps and a tool of its own, under whichever
 * registries are in scope (or its yoke's). What the canvas registers stays
 * here; what it looks up is answered here first, then by the tiers above.
 * With nothing in scope it is a root.
 *
 * Chrome above calls `trigger` / `begin` / `useActiveToolContext` on its own
 * registries, and those reach the active scope: the one last activated — by a
 * pointerdown or wheel — or the newest where none has been.
 */
export function InputScope({ yoke, children }: InputScopeProps): ReactElement {
  const nodes = useNodes(false, yoke === undefined, yoke);
  return <Provide nodes={nodes}>{children}</Provide>;
}

/**
 * @experimental
 * Make a yoke for canvases to join, under the registries in scope where it is
 * called. It lives as long as the calling component.
 */
export function useYoke(): Yoke {
  return useNodes(true, true, undefined);
}

/** Props for `<Yoke>`. */
export interface YokeProps {
  value: Yoke;
  children: ReactNode;
}

/**
 * @experimental
 * Put `value` in scope for what is not a canvas — a toolbar, a status bar — so
 * its actions, deps and tool reads reach the yoke and, through it, the member
 * canvas last used.
 */
export function Yoke({ value, children }: YokeProps): ReactElement {
  return <Provide nodes={value}>{children}</Provide>;
}
