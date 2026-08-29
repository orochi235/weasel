import type { ReactNode } from 'react';
import type { Scene } from 'core/scene/types';
import type { PoseProjection } from '../resize/geometry';
import { RECT_POSE_DESCRIPTOR } from '../resize/geometry';
import { translatePoseViaDescriptor, visualBoundsViaDescriptor } from '../align/align';
import type { DistributeAxis, DistributeMode } from '../distribute/distribute';
import { planDistribute } from '../distribute/plan';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { SelectionApi } from 'core/selection/useSelection';
import type { ImmediateInvoker } from '../invoker';
import { DistributeHorizontalIcon, DistributeVerticalIcon } from './icons/distributeIcons';

const ID_FOR: Record<DistributeAxis, string> = { x: 'distribute.horizontal', y: 'distribute.vertical' };
const LABEL_FOR: Record<DistributeAxis, string> = { x: 'Distribute Horizontally', y: 'Distribute Vertically' };
const ICON_FOR: Record<DistributeAxis, ReactNode> = {
  x: <DistributeHorizontalIcon />,
  y: <DistributeVerticalIcon />,
};

// ---------------------------------------------------------------------------
// Shared helper for descriptor invokers
// ---------------------------------------------------------------------------

/**
 * Apply a distribute operation to the current selection via the Scene API.
 * Uses the kit's default rect-pose geometry; `mode` comes from the binding's
 * `params.mode`. Consumers needing custom geometry use the `useDistribute`
 * hook with their own `PoseProjection`.
 */
function distributeSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  axis: DistributeAxis,
  mode: DistributeMode,
): void {
  const ids = selection.get();
  if (ids.length < 3) return;
  const geom = RECT_POSE_DESCRIPTOR as unknown as PoseProjection<unknown>;

  const items = ids.map((id) => {
    const pose = scene.get(id)?.pose ?? { x: 0, y: 0, width: 0, height: 0 };
    return { id, pose, b: visualBoundsViaDescriptor(pose, geom) };
  });
  const targets = planDistribute(items.map((it) => it.b), axis, mode);

  scene.batch('Distribute', () => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const delta = targets[i] - (axis === 'x' ? it.b.x : it.b.y);
      if (delta === 0) continue;
      const dx = axis === 'x' ? delta : 0;
      const dy = axis === 'y' ? delta : 0;
      const to = translatePoseViaDescriptor(it.pose, dx, dy, geom);
      scene.setPose(it.id, to);
    }
  });
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
    requires: ['selection', 'scene'],
    // No default keybindings. Wire bindings explicitly via the actions registry.
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const selection = deps.selection as SelectionApi | undefined;
        const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
        if (!selection || !scene) return;
        const mode = (params?.mode as DistributeMode | undefined) ?? 'centers';
        distributeSelection(selection, scene, axis, mode);
      },
    } satisfies ImmediateInvoker,
    // Deps-aware, matching `distributeSelection`'s own `ids.length < 3` guard:
    // a constant disabled reason greys the entry out forever (see
    // `requiresSelection`).
    enabled: (deps) => {
      const selection = deps?.selection as SelectionApi | undefined;
      const count = selection?.get().length ?? 0;
      return count >= 3 ? true : ActionDisabledReason.SelectionRequired;
    },
  };
}

/** @experimental Static descriptor for distribute-horizontal. */
export const distributeHorizontalAction = makeDistributeAction('x');
/** @experimental Static descriptor for distribute-vertical. */
export const distributeVerticalAction   = makeDistributeAction('y');

