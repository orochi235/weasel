import type { Action, ActionDeps, BindingOpts, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { resolveParams } from '@weasel-js/routing';
import type { NodeId, Scene } from 'core/scene/types';
import { commitOps } from 'interactions/actions/defaultCommitAdapter';
import { SNAP_ANGLE_STEP, SNAP_ROLES, snapMods } from 'domains/snap/roles';
import { spanSnap } from 'domains/snap/spanSnap';
import { measureBetween, measureEndsOf, withMeasureEnd, type MeasureEnd, type MeasurePoint } from './measurement';
import type { Measurements } from './measurements';
import { measureAt, type MeasureHit } from './measureHit';
import { addMeasureOp, moveEndOps, moveMeasureOps, translatedMeasure } from './measureEdits';
import { MEASURE_ACTION_IDS } from './actionIds';
import type { ImmediateParams } from '@weasel-js/routing';

type AnyScene = Scene<unknown, string, unknown>;

/** Screen-px radius around a measurement that picks it. */
export const MEASURE_HIT_PX = 6;

const pointOf = (at: InvocationCtx): MeasurePoint => at.drag?.current ?? at.world;

/** World units `px` screen pixels span at the deps' view. */
export function pxToWorld(deps: ActionDeps | undefined, px: number): number {
  const scale = deps?.view?.get().scale.x ?? 1;
  return px / (scale || 1);
}

/**
 * The measure tool's drag: from press to pointer, each end through a `point`
 * session of the `snap` dep. While `snap.constrain` (Shift) is held the end
 * stays on the line through the snapped start at the nearest step of the
 * binding param `angleStep` (radians, default 15°), and lands where that line
 * meets a target. The drawing shows in `ms.draft`; on release it becomes a
 * measurement node, one undo step, and the picked one.
 */
export function measureCreateAction(ms: Measurements): Action {
  return {
    id: MEASURE_ACTION_IDS.measure,
    label: 'Measure',
    modifierRoles: SNAP_ROLES,
    requires: ['snap', 'scene', 'applyOps', 'selection'],
    invoker: {
      timing: 'ongoing',
      // The dispatcher builds deps once, for `start`; later events carry none.
      start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
        const deps = ctx.deps;
        // Read on every event, so a step changed mid-drag reaches it.
        const snap = spanSnap(deps.snap, () => {
          const step = resolveParams(opts?.params)?.['angleStep'];
          return { step: typeof step === 'number' ? step : SNAP_ANGLE_STEP };
        });
        const start = snap.start(ctx.drag?.start ?? ctx.world, snapMods(ctx)).point;
        const endAt = (at: InvocationCtx): MeasurePoint => snap.end(pointOf(at), snapMods(at)).point;
        ms.draft.set(measureBetween(start, start));
        return {
          kind: 'measure',
          onMove: (moveCtx) => ms.draft.set(measureBetween(start, endAt(moveCtx))),
          onEnd: (endCtx, reason) => {
            try {
              ms.draft.set(null);
              const scene = deps.scene as AnyScene | undefined;
              if (reason !== 'commit' || !scene) return;
              const end = endAt(endCtx);
              if (end.x === start.x && end.y === start.y) return;
              const { id, op } = addMeasureOp(scene, ms.layer, start, end);
              commitOps(deps, [op], 'Measure');
              ms.picked.set(id);
            } finally {
              snap.close();
            }
          },
        };
      },
    },
  };
}

/** The measure tool's click: picks the measurement under it, or drops the
 *  pick on empty canvas. */
export function measurePickAtAction(ms: Measurements): Action {
  return {
    id: MEASURE_ACTION_IDS.pickAt,
    label: 'Pick Measurement',
    requires: ['scene', 'view'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const press = (params as ImmediateParams | undefined)?.press;
        const scene = deps.scene as AnyScene | undefined;
        if (!scene || !press) return;
        const hit = measureAt(scene, ms, press, pxToWorld(deps, MEASURE_HIT_PX));
        ms.picked.set(hit?.id ?? null);
      },
    },
  };
}

/** What a press on the measurements layer resolved, as its hit-test claims it. */
export const hitOf = (affordance: unknown): MeasureHit | null =>
  (affordance as { payload?: MeasureHit } | null | undefined)?.payload ?? null;

/** A click on a measurement under any tool: picks it, leaving the content
 *  selection as it was. */
export function measurePickAction(ms: Measurements): Action {
  return {
    id: MEASURE_ACTION_IDS.pick,
    label: 'Pick Measurement',
    invoker: {
      timing: 'immediate',
      run: (_deps, params) => {
        const hit = hitOf((params as { affordance?: unknown } | undefined)?.affordance);
        if (hit) ms.picked.set(hit.id);
      },
    },
  };
}

/** The node `id` on `scene`, as a measurement edit reads it. */
function nodeOf(scene: AnyScene | undefined, id: NodeId) {
  return scene?.get(id);
}

/**
 * A drag on a measurement under any tool. On an end of the picked
 * measurement it moves that end, keeping its offset from the press, through
 * a `point` session of the `snap` dep in which the measurement's own ends
 * offer nothing; anywhere else on a
 * measurement it carries the whole measurement with the pointer. Previewed
 * while it runs; one undo step on release.
 */
export function measureDragAction(ms: Measurements): Action {
  return {
    id: MEASURE_ACTION_IDS.drag,
    label: 'Drag Measurement',
    modifierRoles: SNAP_ROLES,
    requires: ['scene', 'snap', 'applyOps', 'selection'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const hit = hitOf(ctx.drag?.affordance);
        const deps = ctx.deps;
        const scene = deps.scene as AnyScene | undefined;
        const node = hit ? nodeOf(scene, hit.id) : undefined;
        if (!hit || !node) return {};
        const end: MeasureEnd | null = hit.part !== 'line' && ms.picked.get() === hit.id ? hit.part : null;
        const from = ctx.drag?.start ?? ctx.world;
        const grabbed = (end && measureEndsOf(node)?.[end]) || from;
        const snap = end ? deps.snap?.begin({ gesture: 'point', press: grabbed, ids: [hit.id] }) ?? null : null;
        let at = from;
        let landed = grabbed;
        const next = () => (end
          ? withMeasureEnd(node, end, landed)
          : translatedMeasure(node, at.x - from.x, at.y - from.y));
        const follow = (c: InvocationCtx) => {
          at = pointOf(c);
          const held = { x: grabbed.x + at.x - from.x, y: grabbed.y + at.y - from.y };
          landed = snap ? snap.at(held, snapMods(c)).point : held;
        };
        ms.picked.set(hit.id);
        return {
          kind: MEASURE_ACTION_IDS.drag,
          onMove: follow,
          onEnd: (endCtx, reason) => {
            try {
              if (reason !== 'commit') return;
              follow(endCtx);
              const ops = end ? moveEndOps(node, end, landed) : moveMeasureOps(node, at.x - from.x, at.y - from.y);
              commitOps(deps, ops, ops[0]?.label ?? 'Move Measurement');
            } finally {
              snap?.end();
            }
          },
          previewIds: () => [hit.id],
          previewOpaqueIds: () => [hit.id],
          previewPose: () => next()?.pose ?? null,
          previewData: () => next()?.data ?? null,
        };
      },
    },
  };
}
