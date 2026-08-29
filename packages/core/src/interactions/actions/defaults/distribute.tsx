import type { ReactNode } from 'react';
import type { Scene } from 'core/scene/types';
import type { PoseProjection } from '../resize/geometry';
import { RECT_POSE_DESCRIPTOR } from '../resize/geometry';
import { translatePoseViaDescriptor, visualBoundsViaDescriptor } from '../align/align';
import type { DistributeAxis } from '../distribute/distribute';
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

interface BoundsLike { x: number; y: number; width: number; height: number }

/**
 * Apply a distribute operation to the current selection via the Scene API.
 * Uses the kit's default rect-pose geometry and 'centers' mode. Consumers
 * that need 'gaps' mode or custom geometry should use the legacy
 * `defaultDistributeActions` factory with a full `DistributeDeps`.
 */
function distributeSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  axis: DistributeAxis,
): void {
  const ids = selection.get();
  if (ids.length < 3) return;
  const geom = RECT_POSE_DESCRIPTOR as unknown as PoseProjection<unknown>;

  const items = ids.map((id, i) => {
    const node = scene.get(id);
    const pose = node?.pose ?? { x: 0, y: 0, width: 0, height: 0 };
    const b = visualBoundsViaDescriptor(pose, geom) as BoundsLike;
    return { id, pose, b, origIndex: i };
  });

  const min = (b: BoundsLike) => (axis === 'x' ? b.x : b.y);
  const size = (b: BoundsLike) => (axis === 'x' ? b.width : b.height);
  const center = (b: BoundsLike) => min(b) + size(b) / 2;

  const sorted = [...items].sort((p, q) => min(p.b) - min(q.b));
  const n = sorted.length;
  const first = sorted[0];
  const last = sorted[n - 1];

  // 'centers' mode (hardcoded for the static descriptor path)
  const c0 = center(first.b);
  const cN = center(last.b);
  const stride = (cN - c0) / (n - 1);

  const targetMin = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const it = sorted[i];
    targetMin.set(it.origIndex, c0 + stride * i - size(it.b) / 2);
  }

  scene.batch('Distribute', () => {
    for (const it of items) {
      const desired = targetMin.get(it.origIndex);
      if (desired === undefined) continue;
      const delta = desired - min(it.b);
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
      run: (deps) => {
        const selection = deps.selection as SelectionApi | undefined;
        const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
        if (!selection || !scene) return;
        distributeSelection(selection, scene, axis);
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

