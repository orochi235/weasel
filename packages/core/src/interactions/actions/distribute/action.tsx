import type { IconRef } from '@weasel-js/icons';
import type { Scene } from 'core/scene/types';
import type { PoseDescriptor } from '../resize/geometry';
import { poseDescriptorOf } from '../poseDescriptorDep';
import { drawnBoxes, type DrawnBoxes } from '../drawnBoxes';
import type { DistributeAxis, DistributeMode } from './distribute';
import { planDistribute } from './plan';
import { scenePoseFrame, type PoseFrame } from '../poseFrame';
import { translateEach } from '../selectionSubtree';
import { transformFinisher, type TransformFinisher } from '../transformFinish';
import type { Action } from '@weasel-js/routing';
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
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  axis: DistributeAxis,
  mode: DistributeMode,
  geom: PoseDescriptor<unknown>,
  boxesOver: (frame: PoseFrame<unknown>) => DrawnBoxes,
  finish?: TransformFinisher,
): void {
  const ids = selection.get();
  if (ids.length < 3) return;
  const frame = scenePoseFrame(scene);
  const boxes = boxesOver(frame);

  const items = ids.map((id) => {
    const pose = frame.world(id);
    return { id, pose, b: boxes.aabb(id, pose) };
  });
  const targets = planDistribute(items.map((it) => it.b), axis, mode);

  const moves = items.map((it, i) => {
    const delta = targets[i] - (axis === 'x' ? it.b.x : it.b.y);
    return { id: it.id, dx: axis === 'x' ? delta : 0, dy: axis === 'y' ? delta : 0 };
  });
  scene.batch('Distribute', () => translateEach(scene, frame, geom, moves, finish, 'Distribute'));
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
    requires: ['selection', 'scene', 'poseDescriptor', 'view', 'boundsIncludeStroke', 'editAnchors'],
    // No default keybindings. Wire bindings explicitly via the actions registry.
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const selection = deps.selection;
        const scene = deps.scene;
        if (!selection || !scene) return;
        const mode = (params?.mode as DistributeMode | undefined) ?? 'centers';
        distributeSelection(
          selection, scene, axis, mode, poseDescriptorOf(deps.poseDescriptor), (frame) => drawnBoxes(deps, frame),
          transformFinisher(deps),
        );
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

