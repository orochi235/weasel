/**
 * The commands that set the selected connectors' router: Around shapes,
 * Orthogonal, Straight, and Curved. Leaving `avoid` drops the stored route;
 * joining it leaves the route to the edit pass `useAvoidRouting` installs,
 * which routes the connectors in the same history entry.
 */
import { ActionDisabledReason, type Action, type ActionDeps, type InvocationCtx } from '@weasel-js/core';
import { diagramEdgeOf, type DiagramEdge } from './edgeTrait';
import { icon } from './icons.gen';
import type { ParticipantSource } from './portAffordance';

/** The router commands' ids, by router key. */
export const SET_ROUTER_ACTION_IDS = {
  avoid: 'diagram.router.avoid',
  orthogonal: 'diagram.router.orthogonal',
  straight: 'diagram.router.straight',
  bezier: 'diagram.router.bezier',
} as const;

/** Each shipped router's name in a menu. */
export const ROUTER_LABELS: Readonly<Record<keyof typeof SET_ROUTER_ACTION_IDS, string>> = {
  avoid: 'Around shapes',
  orthogonal: 'Orthogonal',
  straight: 'Straight',
  bezier: 'Curved',
};

const ROUTER_ICONS = {
  avoid: icon('routerAvoid'),
  orthogonal: icon('routerOrthogonal'),
  straight: icon('routerStraight'),
  bezier: icon('routerCurved'),
} as const;

/** One connector's router changed. */
export interface RouterEdit {
  edgeId: string;
  router: string;
}

/** Options for {@link createSetRouterAction}. */
export interface SetRouterOptions<TPose> {
  participants: ParticipantSource<TPose>;
  /** The selected ids; the connectors among them are set. */
  selected: () => readonly string[];
  /** Defaults to {@link commitRouterToScene} against `deps.scene`. */
  commit?: (edit: RouterEdit, ctx: InvocationCtx) => void;
}

/** `data` with its edge trait on `router`, its stored route dropped. */
export function withRouter(data: unknown, trait: DiagramEdge, router: string): Record<string, unknown> {
  const { route: _r, ...rest } = trait;
  return { ...(data as Record<string, unknown>), diagram: { ...rest, router } };
}

/** The default commit: the connector's `data.diagram.router`, written to the scene. */
export function commitRouterToScene(edit: RouterEdit, ctx: InvocationCtx): void {
  const scene = ctx.deps.scene;
  const node = scene?.get(edit.edgeId as never);
  const trait = node === undefined ? null : diagramEdgeOf(node);
  if (scene === undefined || node === undefined || trait === null) return;
  scene.update(node.id, { data: withRouter(node.data, trait, edit.router) as never });
}

/** The selected connectors, and the router each names. */
function selectedEdges<TPose>(opts: SetRouterOptions<TPose>): { id: string; router: string }[] {
  const ids = new Set(opts.selected());
  if (ids.size === 0) return [];
  const out: { id: string; router: string }[] = [];
  for (const { node } of opts.participants()) {
    const trait = ids.has(node.id) ? diagramEdgeOf(node) : null;
    if (trait !== null) out.push({ id: node.id, router: trait.router ?? 'straight' });
  }
  return out;
}

/** The selected connectors `router` would change, those on another router, or
 *  `'locked'` where `scene` holds one of them locked. */
function routerPlan<TPose>(opts: SetRouterOptions<TPose>, router: string, scene: ActionDeps['scene']): string[] | 'locked' {
  const ids = selectedEdges(opts).filter((e) => e.router !== router).map((e) => e.id);
  return scene !== undefined && ids.some((id) => scene.isLocked(id as never)) ? 'locked' : ids;
}

function routerEnabled(plan: string[] | 'locked'): true | ActionDisabledReason {
  if (plan === 'locked') return ActionDisabledReason.Locked;
  return plan.length > 0 ? true : ActionDisabledReason.NotApplicable;
}

const NO_MODIFIERS = { alt: false, shift: false, meta: false, ctrl: false };

/** The command that puts the selected connectors on `router`, in one history
 *  entry. Active while every selected connector is on it already, and then
 *  disabled, as it would change nothing; disabled too where it would change a
 *  locked one. */
export function createSetRouterAction<TPose>(router: keyof typeof SET_ROUTER_ACTION_IDS, opts: SetRouterOptions<TPose>): Action {
  const { commit = commitRouterToScene } = opts;
  return {
    id: SET_ROUTER_ACTION_IDS[router],
    label: ROUTER_LABELS[router],
    icon: ROUTER_ICONS[router],
    group: 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run(deps) {
        const ids = routerPlan(opts, router, deps.scene);
        if (ids === 'locked' || ids.length === 0) return;
        const ctx = { world: { x: 0, y: 0 }, modifiers: NO_MODIFIERS, deps } as InvocationCtx;
        const all = () => { for (const edgeId of ids) commit({ edgeId, router }, ctx); };
        if (deps.scene === undefined) all();
        else deps.scene.batch(`Route ${ROUTER_LABELS[router].toLowerCase()}`, all);
      },
    },
    enabled: (deps) => routerEnabled(routerPlan(opts, router, deps?.scene)),
    active: () => {
      const edges = selectedEdges(opts);
      return edges.length > 0 && edges.every((e) => e.router === router);
    },
  };
}

/** One command per shipped router, in menu order. */
export function createRouterActions<TPose>(opts: SetRouterOptions<TPose>): Action[] {
  return (Object.keys(SET_ROUTER_ACTION_IDS) as (keyof typeof SET_ROUTER_ACTION_IDS)[]).map((r) => createSetRouterAction(r, opts));
}
