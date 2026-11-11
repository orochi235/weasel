import type { IconRef } from '@weasel-js/icons';
import type { Scene } from 'core/scene/types';
import { drawnBoxes } from '../drawnBoxes';
import type { DistributeAxis, DistributeMode } from './distribute';
import { planDistribute } from './plan';
import { scenePoseFrame } from '../poseFrame';
import type { Op } from 'core/ops/types';
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
 * The ops a distribute of the current selection commits, read through the
 * `poseDescriptor` dep. Empty with fewer than three members, or when they
 * are spaced already.
 *
 * The span being divided is a world span, so the bounds are read and
 * translated in world and each result is stored back in its own parent's
 * frame.
 */
function distributeOps(
  deps: ActionDeps,
  selection: Pick<SelectionApi, 'get'>,
  scene: Scene<unknown, string, unknown>,
  axis: DistributeAxis,
  mode: DistributeMode,
): Op[] {
  const frame = scenePoseFrame(scene);
  const ids = uncarried(frame, withoutPageStructure(scene, selection.get()));
  if (ids.length < 3) return [];
  const boxes = drawnBoxes(deps, frame);

  const items = ids.map((id) => {
    const pose = frame.world(id);
    return { id, pose, b: boxes.aabb(id, pose) };
  });
  const targets = planDistribute(items.map((it) => it.b), axis, mode);

  const moves = items.map((it, i) => {
    const delta = targets[i] - (axis === 'x' ? it.b.x : it.b.y);
    return { ids: [it.id], dx: axis === 'x' ? delta : 0, dy: axis === 'y' ? delta : 0 };
  });
  return moveEachOps(scene, moves, deps, 'Distribute');
}

const modeOf = (params: Readonly<Record<string, unknown>> | undefined): DistributeMode =>
  (params?.mode as DistributeMode | undefined) ?? 'centers';

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
        commitTransformOps(deps, distributeOps(deps, selection, scene, axis, modeOf(params)), 'Distribute');
      },
    } satisfies ImmediateInvoker,
    enabled: (deps, _at, _carried, params) => {
      const selection = deps?.selection;
      const scene = deps?.scene;
      if (!selection || !scene || selection.get().length < 3) return ActionDisabledReason.SelectionRequired;
      return distributeOps(deps, selection, scene, axis, modeOf(params)).length > 0 ? true : ActionDisabledReason.NotApplicable;
    },
  };
}

/** Static descriptor for distribute-horizontal. */
export const distributeHorizontalAction = makeDistributeAction('x');
/** Static descriptor for distribute-vertical. */
export const distributeVerticalAction   = makeDistributeAction('y');

