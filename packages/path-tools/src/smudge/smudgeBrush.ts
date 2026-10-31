/**
 * The Smudge brush's drag: the outlines under a round brush follow the pointer,
 * as one undo entry per stroke.
 */
import {
  type Action, type ActionDeps, ActionDisabledReason, type BindingOpts, type InvocationCtx, type OngoingHandle, resolveParams,
} from '@weasel-js/routing';
import { pxExtent, smudgePath, type PolygonPath } from '@weasel-js/geom';
import { brushRingCursor } from '../simplifyBrush/simplifyBrush';
import { commitOps, reshapeOps, selectedPathNodes, withPath, type PathNode, type SceneNode, pathOperationTags } from '@weasel-js/core';
import { scenePathNodes } from '../shared/scenePaths';
import { icon } from '../icons.gen';

type AnyNode = SceneNode<unknown, string, unknown>;

/** The brush's radius in screen px when no param gives one. */
export const DEFAULT_SMUDGE_RADIUS_PX = 40;
/** How much of the pointer's motion the outline under the brush's center follows,
 *  when no param gives it. */
export const DEFAULT_SMUDGE_STRENGTH = 0.6;

const LABEL = 'Smudge brush';

/** The selected paths, or with none selected, every path that is neither locked nor hidden. */
function smudgeTargets(deps: ActionDeps | undefined): PathNode[] {
  const selected = selectedPathNodes(deps);
  if (selected.length > 0) return selected;
  const scene = deps?.scene as { isLocked?(id: string): boolean; isHidden?(id: string): boolean } | undefined;
  return scenePathNodes(deps).filter((n) => !scene?.isLocked?.(n.id) && !scene?.isHidden?.(n.id));
}

/** The params `smudgeBrush` reads, each on every pointer move. */
export interface SmudgeBrushParams {
  /** The brush's radius, in screen px. */
  radiusPx?: number;
  /** `1` moves the outline under the brush's center as far as the pointer; less, less. */
  strength?: number;
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function radiusOf(params: SmudgeBrushParams | undefined): number {
  return Math.max(1, num(params?.radiusPx, DEFAULT_SMUDGE_RADIUS_PX));
}

function strengthOf(params: SmudgeBrushParams | undefined): number {
  return Math.min(1, Math.max(0, num(params?.strength, DEFAULT_SMUDGE_STRENGTH)));
}

/** The brush's radius in world units: `radiusPx` on screen at the view's scale. */
function worldRadius(deps: ActionDeps, radiusPx: number): number {
  const reach = pxExtent(radiusPx, deps.view?.get().scale ?? { x: 1, y: 1 });
  return Math.max(reach.x, reach.y);
}

/**
 * A drag that pushes the outline of the selected paths, or of every unlocked, shown
 * path while none is selected, along with the pointer (`smudgePath` in `@weasel-js/geom`). Each pointer move is one dab from
 * where the last one ended: points under the brush move with it, most at its center
 * and not at all at its rim, and a long segment the brush meets gets anchors added
 * so it can bend there. `params.radiusPx` is the brush's radius on screen, so it
 * covers the same part of the canvas at every zoom, and `params.strength` how closely
 * the outline follows; both are read on every move. The cursor is a ring the size of
 * the brush. The stroke commits as one undo entry; canceling it leaves the paths as
 * they were.
 */
export const smudgeBrushAction: Action & { requires: string[] } = {
  id: 'smudgeBrush',
  label: LABEL,
  icon: icon('smudgeBrush'),
  tags: pathOperationTags('brush'),
  group: 'path',
  eligible: { capability: 'creates-shapes' },
  cursor: (params) => brushRingCursor(radiusOf(params as SmudgeBrushParams | undefined)),
  requires: ['selection', 'scene', 'view', 'applyOps'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const nodes = smudgeTargets(ctx.deps);
      if (nodes.length === 0) return {};
      const { deps } = ctx;
      const params = (move: InvocationCtx): SmudgeBrushParams =>
        ({ ...resolveParams(opts?.params), ...move.params }) as SmudgeBrushParams;
      let radiusPx = radiusOf(params(ctx));
      let at = { x: ctx.drag?.start.x ?? ctx.world.x, y: ctx.drag?.start.y ?? ctx.world.y };
      const current = new Map<string, { node: PathNode; path: PolygonPath }>();
      const shapeOf = (id: string) => {
        const entry = current.get(id);
        return entry ? withPath(entry.node.node as AnyNode, entry.path) : null;
      };
      return {
        kind: 'smudge-brush',
        cursor: () => brushRingCursor(radiusPx),
        onMove(move: InvocationCtx): void {
          const p = params(move);
          radiusPx = radiusOf(p);
          const to = { x: move.world.x, y: move.world.y };
          const radius = worldRadius(deps, radiusPx);
          for (const node of nodes) {
            const from = current.get(node.id)?.path ?? node.path;
            const next = smudgePath(from, {
              center: at, delta: { x: to.x - at.x, y: to.y - at.y }, radius, strength: strengthOf(p),
            });
            if (next !== from) current.set(node.id, { node, path: next });
          }
          at = to;
        },
        onEnd(_end: InvocationCtx, reason: 'commit' | 'cancel'): void {
          const done = [...current.values()];
          current.clear();
          if (reason === 'cancel' || done.length === 0) return;
          commitOps(deps, done.flatMap(({ node, path }) => reshapeOps(node.node, path, LABEL)), LABEL);
        },
        previewIds: () => (current.size > 0 ? [...current.keys()] : null),
        previewPose: (id: string) => shapeOf(id)?.pose ?? null,
        previewData: (id: string) => shapeOf(id)?.data ?? null,
      };
    },
  },
  enabled: (deps) => (smudgeTargets(deps).length > 0 ? true : ActionDisabledReason.NotApplicable),
};
