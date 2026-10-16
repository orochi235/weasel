import type { Action, ActionDeps, BindingOpts, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { resolveParams } from '@weasel-js/routing';
import type { NodeId, Scene } from 'core/scene/types';
import { commitOps } from 'interactions/actions/defaultCommitAdapter';
import { SHIFT_ANGLE_STEP, snapToAngleStep } from 'interactions/actions/insert/geometry';
import { measureBetween, withMeasureEnd, type MeasureEnd, type MeasurePoint } from './measurement';
import type { Measurements } from './measurements';
import { measureAt, type MeasureHit } from './measureHit';
import { addMeasureOp, moveEndOps, moveMeasureOps, translatedMeasure } from './measureEdits';
import { MEASURE_ACTION_IDS } from './actionIds';

type AnyScene = Scene<unknown, string, unknown>;

/** Screen-px radius around a measurement that picks it. */
export const MEASURE_HIT_PX = 6;

const snapperOf = (deps: ActionDeps) => {
  const dep = deps.snap;
  return (p: MeasurePoint): MeasurePoint => (dep ? dep.point(p) : p);
};

/** World units `px` screen pixels span at the deps' view. */
export function pxToWorld(deps: ActionDeps | undefined, px: number): number {
  const scale = deps?.view?.get().scale.x ?? 1;
  return px / (scale || 1);
}

/**
 * The measure tool's drag: from press to pointer, both ends through the
 * `snap` dep, Shift holding the angle to steps of the binding param
 * `angleStep` (radians, default 15°). The drawing shows in `ms.draft`; on
 * release it becomes a measurement node, one undo step, and the picked one.
 */
export function measureCreateAction(ms: Measurements): Action {
  return {
    id: MEASURE_ACTION_IDS.measure,
    label: 'Measure',
    requires: ['snap', 'scene', 'applyOps', 'selection'],
    invoker: {
      timing: 'ongoing',
      // The dispatcher builds deps once, for `start`; later events carry none.
      start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
        const deps = ctx.deps;
        const snap = snapperOf(deps);
        const start = snap(ctx.drag?.start ?? ctx.world);
        const endAt = (at: InvocationCtx): MeasurePoint => {
          const raw = at.drag?.current ?? at.world;
          if (!at.modifiers?.shift) return snap(raw);
          // Re-read each event, so a step changed mid-drag reaches it.
          const step = resolveParams(opts?.params)?.['angleStep'];
          return snap(snapToAngleStep(start, raw, typeof step === 'number' ? step : SHIFT_ANGLE_STEP));
        };
        ms.draft.set(measureBetween(start, start));
        return {
          kind: 'measure',
          onMove: (moveCtx) => ms.draft.set(measureBetween(start, endAt(moveCtx))),
          onEnd: (endCtx, reason) => {
            ms.draft.set(null);
            const scene = deps.scene as AnyScene | undefined;
            if (reason !== 'commit' || !scene) return;
            const end = endAt(endCtx);
            if (end.x === start.x && end.y === start.y) return;
            const { id, op } = addMeasureOp(scene, ms.layer, start, end);
            commitOps(deps, [op], 'Measure');
            ms.picked.set(id);
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
        const p = params as { pressX?: number; pressY?: number } | undefined;
        const scene = deps.scene as AnyScene | undefined;
        if (!scene || p?.pressX === undefined || p.pressY === undefined) return;
        const hit = measureAt(scene, ms, { x: p.pressX, y: p.pressY }, pxToWorld(deps, MEASURE_HIT_PX));
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
 * measurement it moves that end, through the `snap` dep; anywhere else on a
 * measurement it carries the whole measurement with the pointer. Previewed
 * while it runs; one undo step on release.
 */
export function measureDragAction(ms: Measurements): Action {
  return {
    id: MEASURE_ACTION_IDS.drag,
    label: 'Drag Measurement',
    requires: ['scene', 'snap', 'applyOps', 'selection'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const hit = hitOf(ctx.drag?.affordance);
        const deps = ctx.deps;
        const scene = deps.scene as AnyScene | undefined;
        const node = hit ? nodeOf(scene, hit.id) : undefined;
        if (!hit || !node) return {};
        const snap = snapperOf(deps);
        const end: MeasureEnd | null = hit.part !== 'line' && ms.picked.get() === hit.id ? hit.part : null;
        const from = ctx.drag?.start ?? ctx.world;
        let at = from;
        const next = () => (end
          ? withMeasureEnd(node, end, snap(at))
          : translatedMeasure(node, at.x - from.x, at.y - from.y));
        ms.picked.set(hit.id);
        return {
          kind: MEASURE_ACTION_IDS.drag,
          onMove: (moveCtx) => { at = moveCtx.drag?.current ?? moveCtx.world; },
          onEnd: (endCtx, reason) => {
            if (reason !== 'commit') return;
            at = endCtx.drag?.current ?? endCtx.world;
            const ops = end ? moveEndOps(node, end, snap(at)) : moveMeasureOps(node, at.x - from.x, at.y - from.y);
            commitOps(deps, ops, ops[0]?.label ?? 'Move Measurement');
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
