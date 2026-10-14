import type { Action, ActionDeps, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { Scene } from 'core/scene/types';
import { snapTo15Degrees } from 'interactions/actions/insert/geometry';
import { translateSelection } from 'interactions/actions/defaults/nudge';
import { requiresSelection } from 'interactions/actions/defaults/requiresSelection';
import { commitOps } from 'interactions/actions/defaultCommitAdapter';
import { poseDescriptorOf } from 'interactions/actions/poseDescriptorDep';
import { rotateSelectionOps } from 'interactions/actions/rotate/replay';
import { recordTransform } from 'interactions/actions/transform-again/memory';
import { measureBetween, type MeasurePoint, type MeasurementStore } from './measurement';

/** The ids of the actions {@link createMeasureActions} makes. All but the
 *  drag are in the `measure` group, so `<ActionBar group="measure">` draws
 *  the commands a readout offers. */
export const MEASURE_ACTION_IDS = {
  /** The drag that measures. */
  measure: 'measure',
  moveBy: 'measure.moveBy',
  rotateBy: 'measure.rotateBy',
  clear: 'measure.clear',
} as const;

const MOVE_LABEL = 'Move by Measurement';
const ROTATE_LABEL = 'Rotate by Measurement';

type AnyScene = Scene<unknown, string, unknown>;

function measureDrag(store: MeasurementStore): Action {
  return {
    id: MEASURE_ACTION_IDS.measure,
    label: 'Measure',
    requires: ['snap'],
    invoker: {
      timing: 'ongoing',
      // The dispatcher builds deps once, for `start`; later events carry none.
      start(ctx: InvocationCtx): OngoingHandle {
        const snapDep = ctx.deps.snap;
        const snap = (p: MeasurePoint): MeasurePoint => (snapDep ? snapDep.point(p) : p);
        const start = snap(ctx.drag?.start ?? ctx.world);
        const endAt = (at: InvocationCtx): MeasurePoint => {
          const raw = at.drag?.current ?? at.world;
          return snap(at.modifiers?.shift ? snapTo15Degrees(start, raw) : raw);
        };
        store.set(measureBetween(start, start));
        return {
          kind: 'measure',
          onMove: (moveCtx) => store.set(measureBetween(start, endAt(moveCtx))),
          onEnd: (endCtx, reason) => {
            const m = reason === 'commit' ? measureBetween(start, endAt(endCtx)) : null;
            store.set(m && m.distance > 0 ? m : null);
          },
        };
      },
    },
  };
}

/** Enabled with a measurement to apply and a selection to apply it to. */
function transformable(store: MeasurementStore) {
  return (deps?: ActionDeps) => {
    const m = store.get();
    if (!m || m.distance === 0) return ActionDisabledReason.NotApplicable;
    return requiresSelection(deps);
  };
}

function moveBy(store: MeasurementStore): Action {
  return {
    id: MEASURE_ACTION_IDS.moveBy,
    label: MOVE_LABEL,
    group: 'measure',
    eligible: { capability: 'transforms-selection' },
    requires: ['selection', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor'],
    enabled: transformable(store),
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const m = store.get();
        const { selection, scene } = deps;
        if (!m || !selection || !scene) return;
        const moved = translateSelection(
          selection, scene, m.dx, m.dy, deps.applyOps, deps.geometryProjection,
          poseDescriptorOf(deps.poseDescriptor), MOVE_LABEL,
        );
        if (moved) recordTransform(scene, { kind: 'translate', dx: m.dx, dy: m.dy }, selection.get());
      },
    },
  };
}

function rotateBy(store: MeasurementStore): Action {
  return {
    id: MEASURE_ACTION_IDS.rotateBy,
    label: ROTATE_LABEL,
    group: 'measure',
    eligible: { capability: 'transforms-selection' },
    requires: ['selection', 'scene', 'applyOps', 'poseDescriptor', 'view'],
    enabled: transformable(store),
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const m = store.get();
        const { selection } = deps;
        const scene = deps.scene as AnyScene | undefined;
        if (!m || !selection || !scene) return;
        const selected = selection.get() as string[];
        const ops = rotateSelectionOps(
          scene, selected, deps.view, deps.poseDescriptor, m.angle, 'union', ROTATE_LABEL,
        );
        if (ops.length === 0) return;
        commitOps(deps, ops, ROTATE_LABEL);
        recordTransform(scene, { kind: 'rotate', angle: m.angle, pivot: 'union' }, selected);
      },
    },
  };
}

function clear(store: MeasurementStore): Action {
  return {
    id: MEASURE_ACTION_IDS.clear,
    label: 'Clear Measurement',
    group: 'measure',
    // Declining with nothing measured leaves Escape to the ambient `escape`.
    enabled: () => (store.get() ? true : ActionDisabledReason.NotApplicable),
    invoker: { timing: 'immediate', run: () => store.set(null) },
  };
}

/**
 * The measure tool's actions, all reading and writing `store`: the drag that
 * measures from press to pointer — through the `snap` dep at both ends, Shift
 * holding the angle to 15° steps — and the commands that move the selection by
 * the measured offset or turn it about its center by the measured angle, each
 * one undo step that Transform Again can repeat.
 */
export function createMeasureActions(store: MeasurementStore): Action[] {
  return [measureDrag(store), moveBy(store), rotateBy(store), clear(store)];
}
