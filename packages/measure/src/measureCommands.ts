import type { Action, ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { type AnyScene, commitOps, type NodeId, reachesLocked, requiresSelection, transformSelection } from '@weasel-js/core';
import { measurementOf, type Measurement } from './measurement';
import { currentMeasureId, measureIds, type Measurements } from './measurements';
import { deleteMeasureOps, MEASURE_LABELS } from './measureEdits';
import { MEASURE_ACTION_IDS } from './actionIds';

const MOVE_LABEL = 'Move by Measurement';
const ROTATE_LABEL = 'Rotate by Measurement';

function current(deps: ActionDeps | undefined, ms: Measurements): { id: NodeId; m: Measurement } | null {
  const scene = deps?.scene as AnyScene | undefined;
  if (!scene) return null;
  const id = currentMeasureId(scene, ms);
  const m = id === null ? null : measurementOf(scene.get(id));
  return id !== null && m ? { id, m } : null;
}

/** Enabled with a measurement `moves` reads as a change and a selection to apply it to. */
function transformable(ms: Measurements, moves: (m: Measurement) => boolean) {
  return (deps?: ActionDeps) => {
    const c = current(deps, ms);
    if (!c || !moves(c.m)) return ActionDisabledReason.NotApplicable;
    return requiresSelection(deps);
  };
}

const travels = (m: Measurement): boolean => m.distance !== 0;
/** A measurement along the x axis turns nothing. */
const turns = (m: Measurement): boolean => m.distance !== 0 && m.angle !== 0;

function moveBy(ms: Measurements): Action {
  return {
    id: MEASURE_ACTION_IDS.moveBy,
    label: MOVE_LABEL,
    group: 'measure',
    eligible: { capability: 'transforms-selection' },
    requires: ['selection', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor', 'transformFollowers'],
    enabled: transformable(ms, travels),
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const c = current(deps, ms);
        if (c) transformSelection(deps, { kind: 'translate', dx: c.m.dx, dy: c.m.dy }, MOVE_LABEL);
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
    requires: ['selection', 'scene', 'applyOps', 'poseDescriptor', 'view', 'boundsIncludeStroke', 'drawnBoxes', 'transformFollowers'],
    enabled: transformable(ms, turns),
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const c = current(deps, ms);
        // The measurement reads counterclockwise-positive; the canvas turns clockwise-positive.
        if (c) transformSelection(deps, { kind: 'rotate', angle: -c.m.angle, pivot: 'union' }, ROTATE_LABEL);
      },
    },
  };
}

/** Whether removing `ids` would reach a locked node, which disables a removal rather than throwing from it. */
const removesLocked = (deps: ActionDeps | undefined, ids: readonly NodeId[]): boolean =>
  reachesLocked(deps?.scene as never, ids);

function remove(ms: Measurements): Action {
  return {
    id: MEASURE_ACTION_IDS.delete,
    label: MEASURE_LABELS.delete,
    group: 'measure',
    requires: ['scene', 'applyOps', 'selection'],
    // Declining with nothing measured leaves Delete to the ambient `delete`.
    enabled: (deps) => {
      const c = current(deps, ms);
      if (!c) return ActionDisabledReason.NotApplicable;
      return removesLocked(deps, [c.id]) ? ActionDisabledReason.Locked : true;
    },
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const c = current(deps, ms);
        if (!c || removesLocked(deps, [c.id])) return;
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
    enabled: (deps) => {
      const ids = all(deps);
      if (ids.length === 0) return ActionDisabledReason.NotApplicable;
      return removesLocked(deps, ids) ? ActionDisabledReason.Locked : true;
    },
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const ids = all(deps);
        if (ids.length === 0 || removesLocked(deps, ids)) return;
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
