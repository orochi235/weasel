/**
 * Following a connector off the page: a double-click on an off-page tag goes
 * to the page at the connector's far end and selects the shape there.
 */
import {
  ActionDisabledReason,
  bodyPredicate,
  fitViewToPage,
  placedPagesOf,
  type Action,
  type ActionDeps,
  type Contribution,
  type GestureBinding,
  type InvocationCtx,
} from '@weasel-js/core';
import { diagramEdgeOf } from '../edgeTrait';
import { offPageTagOf } from './trait';

/** The action that follows an off-page tag to its far page. */
export const FOLLOW_OFF_PAGE_ACTION_ID = 'diagram.followOffPage';

/** Where a tag leads: the shape at its connector's far end, and that shape's page. */
export interface OffPageTarget {
  tag: string;
  edge: string;
  node: string;
  page: string;
}

type SceneReads = NonNullable<ActionDeps['scene']>;

/** Where tag `tagId` leads, or `null` when it is no tag of a split connector. */
export function offPageTargetOf(scene: SceneReads, tagId: string): OffPageTarget | null {
  const node = scene.get(tagId as never);
  const tag = node === undefined ? null : offPageTagOf(node);
  const edgeNode = tag === null ? undefined : scene.get(tag.edge as never);
  const split = edgeNode === undefined ? undefined : diagramEdgeOf(edgeNode)?.offPage;
  const deps = edgeNode?.dependsOn;
  if (tag === null || split === undefined || !Array.isArray(deps)) return null;
  const far = tag.end === 'from' ? 1 : 0;
  return { tag: tagId, edge: tag.edge, node: deps[far]!, page: far === 1 ? split.to : split.from };
}

/** Options for {@link createFollowOffPageAction}. */
export interface FollowOffPageOptions {
  /** Runs in place of the default, which selects `target.node` and fits the view to `target.page`. */
  follow?: (target: OffPageTarget, ctx: InvocationCtx) => void;
  /** Screen pixels the default leaves around the page it fits. Default 24. */
  padding?: number;
}

function tagUnder(deps: ActionDeps | undefined, at: { x: number; y: number } | undefined): OffPageTarget | null {
  if (deps?.scene === undefined || at === undefined) return null;
  const id = deps.nodeAtPoint?.(at);
  return id == null ? null : offPageTargetOf(deps.scene, id);
}

function followDefault(target: OffPageTarget, ctx: InvocationCtx, padding: number): void {
  const { scene, selection, view } = ctx.deps;
  if (scene === undefined) return;
  selection?.set([target.node as never]);
  const page = placedPagesOf(scene).find((p) => p.id === target.page);
  const size = view?.hostSize?.();
  if (page === undefined || view === undefined || size == null) return;
  view.set(fitViewToPage(page, size, view.get(), { padding }));
}

/**
 * Goes to the far page of the off-page tag a double-click lands on, and
 * selects the shape at the connector's far end there. It declines a
 * double-click on anything else.
 */
export function createFollowOffPageAction(opts: FollowOffPageOptions = {}): Action {
  const padding = opts.padding ?? 24;
  const follow = opts.follow ?? ((target: OffPageTarget, ctx: InvocationCtx) => followDefault(target, ctx, padding));
  return {
    id: FOLLOW_OFF_PAGE_ACTION_ID,
    label: 'Go to the other page',
    group: 'diagram',
    requires: ['scene', 'nodeAtPoint', 'selection', 'view'],
    eligible: { mode: { in: ['normal', 'isolation'] } },
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const world = { x: Number(params?.worldX), y: Number(params?.worldY) };
        const target = tagUnder(deps, world);
        if (target === null) return;
        follow(target, { world, modifiers: { alt: false, shift: false, meta: false, ctrl: false }, deps } as InvocationCtx);
      },
    },
    enabled: (deps, at) => (tagUnder(deps, at) !== null ? true : ActionDisabledReason.NotApplicable),
  };
}

const onBody = bodyPredicate((target) => target === 'selected-body' || target === 'unselected-body');

/** A double-click on a node's body; the action itself declines unless that node is an off-page tag. */
export function followOffPageBinding(actionId: string = FOLLOW_OFF_PAGE_ACTION_ID): GestureBinding {
  return { spec: { kind: 'doubleClick', target: { kindOf: onBody } }, actionId };
}

/** Following off-page tags, as a contribution to pass as `ambient`. */
export function diagramOffPage(opts: FollowOffPageOptions = {}): { contribution: Contribution } {
  return {
    contribution: {
      id: 'weasel-diagram-off-page',
      eligibility: { always: true },
      actions: [createFollowOffPageAction(opts)],
      bindings: [followOffPageBinding()],
    },
  };
}
