/**
 * The Smudge brush's drag: the outlines under a round brush follow the pointer,
 * text included once the brush reaches it, as one undo entry per stroke.
 */
import {
  type Action, type ActionDeps, ActionDisabledReason, type BindingOpts, type InvocationCtx, type OngoingHandle, resolveParams,
} from '@weasel-js/routing';
import { pref } from '@weasel-js/prefs';
import { pxExtent, smudgePath, type PolygonPath } from '@weasel-js/geom';
import { brushRingCursor } from '../simplifyBrush/simplifyBrush';
import { commitOps, drawnAABBOf, reshapeOps, withPath, type PathNode, type SceneNode, pathOperationTags } from '@weasel-js/core';
import { icon } from '../icons.gen';
import { smudgeTargets } from './smudgeTargets';
import { outlineSession } from '../shared/outlineSession';

type AnyNode = SceneNode<unknown, string, unknown>;
type Point = { x: number; y: number };

/** The brush's radius in screen px when no param gives one. */
export const DEFAULT_SMUDGE_RADIUS_PX = 40;
/** How much of the pointer's motion the outline under the brush's center follows,
 *  when no param gives it. */
export const DEFAULT_SMUDGE_STRENGTH = 0.6;

const LABEL = 'Smudge brush';

/** The brush's size and strength as a form: the last-operation panel's after a stroke, and the tool's options
 *  (`SMUDGE_BRUSH_OPTIONS`), which are one setting. */
export const SMUDGE_BRUSH_PARAMS = pref.group(LABEL, {
  radiusPx: pref.number('Size', DEFAULT_SMUDGE_RADIUS_PX, {
    description: 'The brush radius, in screen pixels.', min: 2, max: 400, step: 1, control: 'slider',
  }),
  strength: pref.number('Strength', DEFAULT_SMUDGE_STRENGTH, {
    description: 'How closely the outline under the brush follows the pointer.', min: 0.05, max: 1, step: 0.05, control: 'slider',
  }),
}, { description: 'The size and strength of the Smudge brush.' });

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

/** Whether the disc at `c` of radius `r` meets box `b`. */
function discMeetsBox(c: Point, r: number, b: { x: number; y: number; width: number; height: number }): boolean {
  const dx = c.x - Math.max(b.x, Math.min(c.x, b.x + b.width));
  const dy = c.y - Math.max(b.y, Math.min(c.y, b.y + b.height));
  return dx * dx + dy * dy <= r * r;
}

/** The brush's radius in world units: `radiusPx` on screen at the view's `scale`. */
function worldRadius(scale: { x: number; y: number } | undefined, radiusPx: number): number {
  const reach = pxExtent(radiusPx, scale ?? { x: 1, y: 1 });
  return Math.max(reach.x, reach.y);
}

/** One dab: where the pointer moved to, and the view's scale as it did. */
interface Dab {
  to: Point;
  scale: { x: number; y: number } | undefined;
}

/** A stroke over what `deps` targets now, from `start`, dab by dab: text converts as the brush meets it, and
 *  `shapes` holds every path it has moved. */
function strokeFrom(deps: ActionDeps, start: Point) {
  const targets = smudgeTargets(deps);
  const nodes = [...targets.paths];
  const text = outlineSession(deps, targets.texts, LABEL);
  const shapes = new Map<string, { node: PathNode; path: PolygonPath }>();
  let at = start;
  return {
    empty: targets.paths.length === 0 && targets.texts.length === 0,
    text,
    shapes,
    dab({ to, scale }: Dab, params: SmudgeBrushParams | undefined): void {
      const radius = worldRadius(scale, radiusOf(params));
      nodes.push(...text.convert((id, scene) =>
        discMeetsBox(at, radius, drawnAABBOf(scene, id, scene.get(id)!.pose, scale ? { scale } : {}))));
      for (const node of nodes) {
        const from = shapes.get(node.id)?.path ?? node.path;
        const next = smudgePath(from, {
          center: at, delta: { x: to.x - at.x, y: to.y - at.y }, radius, strength: strengthOf(params),
        });
        if (next !== from) shapes.set(node.id, { node, path: next });
      }
      at = to;
    },
    /** Land the conversions and every moved path as one undo entry. */
    commit(): void {
      const done = [...shapes.values()];
      shapes.clear();
      text.commit(() => commitOps(deps, done.flatMap(({ node, path }) => reshapeOps(node.node, path, LABEL)), LABEL), LABEL);
    },
  };
}

/**
 * A drag that pushes the outline of the selected paths and text, or of every
 * unlocked, shown path and text node while none is selected, along with the pointer (`smudgePath` in `@weasel-js/geom`). Each pointer move is one dab from
 * where the last one ended: points under the brush move with it, most at its center
 * and not at all at its rim, and a long segment the brush meets gets anchors added
 * so it can bend there. `params.radiusPx` is the brush's radius on screen, so it
 * covers the same part of the canvas at every zoom, and `params.strength` how closely
 * the outline follows; both are read on every move. The cursor is a ring the size of
 * the brush. A text node is converted to outlines, as Create Outlines does, when the
 * brush first meets it, and its paths are pushed from then on; a face with no outlines
 * leaves its text alone and tells the user through the `notices` dep. The stroke,
 * conversions and all, commits as one undo entry; canceling it leaves everything as
 * it was. The last-operation panel changes Size and Strength by replaying every dab
 * from the stroke's start, text put back and met again by the brush at its new size.
 */
export const smudgeBrushAction: Action & { requires: string[] } = {
  id: 'smudgeBrush',
  label: LABEL,
  icon: icon('smudgeBrush'),
  tags: pathOperationTags('brush'),
  group: 'path',
  eligible: { capability: 'creates-shapes' },
  cursor: (params) => brushRingCursor(radiusOf(params as SmudgeBrushParams | undefined)),
  requires: ['selection', 'scene', 'view', 'applyOps', 'history', 'createOutlinesAdapter', 'notices'],
  params: SMUDGE_BRUSH_PARAMS,
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const { deps } = ctx;
      const start = { x: ctx.drag?.start.x ?? ctx.world.x, y: ctx.drag?.start.y ?? ctx.world.y };
      const live = strokeFrom(deps, start);
      if (live.empty) return {};
      const params = (move: InvocationCtx): SmudgeBrushParams =>
        ({ ...resolveParams(opts?.params), ...move.params }) as SmudgeBrushParams;
      let radiusPx = radiusOf(params(ctx));
      // Every dab, since each pushes on from where the one before left the outline.
      const dabs: Dab[] = [];
      const shapeOf = (id: string) => {
        const entry = live.shapes.get(id);
        return entry ? withPath(entry.node.node as AnyNode, entry.path) : null;
      };
      return {
        kind: 'smudge-brush',
        cursor: () => brushRingCursor(radiusPx),
        onMove(move: InvocationCtx): void {
          const p = params(move);
          radiusPx = radiusOf(p);
          const dab = { to: { x: move.world.x, y: move.world.y }, scale: deps.view?.get().scale };
          dabs.push(dab);
          live.dab(dab, p);
        },
        onEnd(_end: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') { live.shapes.clear(); live.text.cancel(); return; }
          live.commit();
        },
        replay(replayed: Record<string, unknown>): void {
          const again = strokeFrom(deps, start);
          for (const dab of dabs) again.dab(dab, replayed as SmudgeBrushParams);
          again.commit();
        },
        previewIds: () => (live.shapes.size > 0 ? [...live.shapes.keys()] : null),
        previewPose: (id: string) => shapeOf(id)?.pose ?? null,
        previewData: (id: string) => shapeOf(id)?.data ?? null,
      };
    },
  },
  enabled: (deps) => {
    const { paths, texts } = smudgeTargets(deps);
    return paths.length > 0 || texts.length > 0 ? true : ActionDisabledReason.NotApplicable;
  },
};
