import type { IconRef } from '@weasel-js/icons';
import type { Scene } from 'core/scene/types';
import { drawnBoxes, type DrawnBoxes } from '../drawnBoxes';
import type { DistributeAxis, DistributeMode } from './distribute';
import { planDistribute } from './plan';
import { scenePoseFrame, type PoseFrame } from '../poseFrame';
import { moveEachOps } from '../moveNodes';
import { uncarried } from '../selectionSubtree';
import { withoutPageStructure } from 'core/scene/nodeGates';
import { commitTransformOps } from '../transformFinish';
import type { Action, ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { SelectionApi } from 'core/selection/useSelection';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { icon } from '../../../icons.gen';

const ID_FOR: Record<DistributeAxis, string> = { x: 'distribute.horizontal', y: 'distribute.vertical' };
const LABEL_FOR: Record<DistributeAxis, string> = { x: 'Distribute Horizontally', y: 'Distribute Vertically' };
const ICON_FOR: Record<DistributeAxis, IconRef> = {
  x: icon('distributeHorizontal'),
  y: icon('distributeVertical'),
};

// ---------------------------------------------------------------------------
// Shared helper for descriptor invokers
// ---------------------------------------------------------------------------

/**
 * Apply a distribute operation to the current selection via the Scene API.
 * Reads poses through the `poseDescriptor` dep; `mode` comes from the
 * binding's `params.mode`.
 *
 * The span being divided is a world span, so the bounds are read and
 * translated in world and each result is stored back in its own parent's
 * frame.
 */
function distributeSelection(
  deps: ActionDeps,
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  axis: DistributeAxis,
  mode: DistributeMode,
  boxesOver: (frame: PoseFrame<unknown>) => DrawnBoxes,
): void {
  const frame = scenePoseFrame(scene);
  const ids = uncarried(frame, withoutPageStructure(scene, selection.get()));
  if (ids.length < 3) return;
  const boxes = boxesOver(frame);

  const items = ids.map((id) => {
    const pose = frame.world(id);
    return { id, pose, b: boxes.aabb(id, pose) };
  });
  const targets = planDistribute(items.map((it) => it.b), axis, mode);

  const moves = items.map((it, i) => {
    const delta = targets[i] - (axis === 'x' ? it.b.x : it.b.y);
    return { ids: [it.id], dx: axis === 'x' ? delta : 0, dy: axis === 'y' ? delta : 0 };
  });
  commitTransformOps(deps, moveEachOps(scene, moves, deps, 'Distribute'), 'Distribute');
}

// ---------------------------------------------------------------------------
// Static descriptors
// ---------------------------------------------------------------------------

function makeDistributeAction(axis: DistributeAxis): Action {
  return {
    id: ID_FOR[axis],
    label: LABEL_FOR[axis],
    icon: ICON_FOR[axis],
    group: 'distribute',
    eligible: { capability: 'transforms-selection' },
    requires: ['selection', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor', 'view', 'boundsIncludeStroke', 'drawnBoxes', 'transformFollowers'],
    // No default keybindings. Wire bindings explicitly via the actions registry.
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const selection = deps.selection;
        const scene = deps.scene;
        if (!selection || !scene) return;
        const mode = (params?.mode as DistributeMode | undefined) ?? 'centers';
        distributeSelection(deps, selection, scene, axis, mode, (frame) => drawnBoxes(deps, frame));
      },
    } satisfies ImmediateInvoker,
    // Deps-aware, matching `distributeSelection`'s own `ids.length < 3` guard:
    // a constant disabled reason greys the entry out forever (see
    // `requiresSelection`).
    enabled: (deps) => {
      const selection = deps?.selection;
      const count = selection?.get().length ?? 0;
      return count >= 3 ? true : ActionDisabledReason.SelectionRequired;
    },
  };
}

/** Static descriptor for distribute-horizontal. */
export const distributeHorizontalAction = makeDistributeAction('x');
/** Static descriptor for distribute-vertical. */
export const distributeVerticalAction   = makeDistributeAction('y');

