import type { Action, ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { NodeId, Scene } from 'core/scene/types';
import { translateSelection } from 'interactions/actions/defaults/nudge';
import { requiresSelection } from 'interactions/actions/defaults/requiresSelection';
import { commitOps } from 'interactions/actions/defaultCommitAdapter';
import { commitTransformOps, transformApplyOps } from 'interactions/actions/transformFinish';
import { poseDescriptorOf } from 'interactions/actions/poseDescriptorDep';
import { rotateSelectionOps } from 'interactions/actions/rotate/replay';
import { recordTransform } from 'interactions/actions/transform-again/memory';
import { measurementOf, type Measurement } from './measurement';
import { currentMeasureId, measureIds, type Measurements } from './measurements';
import { deleteMeasureOps, MEASURE_LABELS } from './measureEdits';
import { MEASURE_ACTION_IDS } from './actionIds';

const MOVE_LABEL = 'Move by Measurement';
const ROTATE_LABEL = 'Rotate by Measurement';

type AnyScene = Scene<unknown, string, unknown>;

function current(deps: ActionDeps | undefined, ms: Measurements): { id: NodeId; m: Measurement } | null {
  const scene = deps?.scene as AnyScene | undefined;
  if (!scene) return null;
  const id = currentMeasureId(scene, ms);
  const m = id === null ? null : measurementOf(scene.get(id));
  return id !== null && m ? { id, m } : null;
}

/** Enabled with a measurement to apply and a selection to apply it to. */
function transformable(ms: Measurements) {
  return (deps?: ActionDeps) => {
    const c = current(deps, ms);
    if (!c || c.m.distance === 0) return ActionDisabledReason.NotApplicable;
    return requiresSelection(deps);
  };
}

function moveBy(ms: Measurements): Action {
  return {
    id: MEASURE_ACTION_IDS.moveBy,
    label: MOVE_LABEL,
    group: 'measure',
    eligible: { capability: 'transforms-selection' },
    requires: ['selection', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor', 'transformFollowers'],
    enabled: transformable(ms),
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const c = current(deps, ms);
        const { selection, scene } = deps;
        if (!c || !selection || !scene) return;
        const { dx, dy } = c.m;
        const moved = translateSelection(
          selection, scene, dx, dy, transformApplyOps(deps), deps.geometryProjection,
          poseDescriptorOf(deps.poseDescriptor), MOVE_LABEL,
        );
        if (moved) recordTransform(scene, { kind: 'translate', dx, dy }, selection.get());
      },
    },
  };
}

function rotateBy(ms: Measurements): Action {
  return {
    id: MEASURE_ACTION_IDS.rotateBy,
    label: ROTATE_LABEL,
    group: 'measure',
    eligible: { capability: 'transforms-selection' },
    requires: ['selection', 'scene', 'applyOps', 'poseDescriptor', 'view', 'transformFollowers'],
    enabled: transformable(ms),
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const c = current(deps, ms);
        const { selection } = deps;
        const scene = deps.scene as AnyScene | undefined;
        if (!c || !selection || !scene) return;
        const selected = selection.get() as string[];
        // The measurement reads counterclockwise-positive; the canvas turns clockwise-positive.
        const turn = -c.m.angle;
        const ops = rotateSelectionOps(
          scene, selected, deps, turn, 'union', ROTATE_LABEL,
        );
        if (!commitTransformOps(deps, ops, ROTATE_LABEL)) return;
        recordTransform(scene, { kind: 'rotate', angle: turn, pivot: 'union' }, selected);
      },
    },
  };
}

function remove(ms: Measurements): Action {
  return {
    id: MEASURE_ACTION_IDS.delete,
    label: MEASURE_LABELS.delete,
    group: 'measure',
    requires: ['scene', 'applyOps', 'selection'],
    // Declining with nothing measured leaves Delete to the ambient `delete`.
    enabled: (deps) => (current(deps, ms) ? true : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const c = current(deps, ms);
        if (!c) return;
        commitOps(deps, deleteMeasureOps(deps.scene as AnyScene, [c.id], MEASURE_LABELS.delete), MEASURE_LABELS.delete);
        if (ms.picked.get() === c.id) ms.picked.set(null);
      },
    },
  };
}

function clearAll(ms: Measurements): Action {
  const all = (deps: ActionDeps | undefined) => {
    const scene = deps?.scene as AnyScene | undefined;
    return scene ? measureIds(scene, ms) : [];
  };
  return {
    id: MEASURE_ACTION_IDS.clear,
    label: MEASURE_LABELS.clear,
    group: 'measure',
    requires: ['scene', 'applyOps', 'selection'],
    enabled: (deps) => (all(deps).length > 0 ? true : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const ids = all(deps);
        if (ids.length === 0) return;
        commitOps(deps, deleteMeasureOps(deps.scene as AnyScene, ids, MEASURE_LABELS.clear), MEASURE_LABELS.clear);
        ms.picked.set(null);
      },
    },
  };
}

function unpick(ms: Measurements): Action {
  return {
    id: MEASURE_ACTION_IDS.unpick,
    label: 'Deselect Measurement',
    // Declining with nothing picked leaves Escape to the ambient `escape`.
    enabled: () => (ms.picked.get() !== null ? true : ActionDisabledReason.NotApplicable),
    invoker: { timing: 'immediate', run: () => ms.picked.set(null) },
  };
}

/**
 * The commands over a scene's measurements: move the content selection by
 * the current measurement's offset, or turn it about its center by the
 * measured angle — each one undo step Transform Again can repeat — delete the
 * current measurement, clear them all, and drop the pick. The current
 * measurement is the picked one, else the newest. All but the pick's are in
 * the `measure` group.
 */
export function measureCommands(ms: Measurements): Action[] {
  return [moveBy(ms), rotateBy(ms), remove(ms), clearAll(ms), unpick(ms)];
}
