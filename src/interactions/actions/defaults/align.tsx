import type { ReactNode } from 'react';
import type { Scene } from 'core/scene/types';
import type { PoseProjection } from '../resize/geometry';
import { RECT_POSE_DESCRIPTOR } from '../resize/geometry';
import type { ResizePose } from '../../gestures/types';
import { alignDeltaFor, translatePoseViaDescriptor, type AlignEdge } from '../align/align';
import { unionBounds } from 'features/groups/unionBounds';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { SelectionApi } from 'core/selection/useSelection';
import type { ImmediateInvoker } from '../invoker';
import {
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignBottomIcon,
  AlignCenterXIcon,
  AlignCenterYIcon,
} from './icons/alignIcons';
const ID_FOR: Record<AlignEdge, string> = {
  'left': 'align.left',
  'right': 'align.right',
  'top': 'align.top',
  'bottom': 'align.bottom',
  'center-x': 'align.centerX',
  'center-y': 'align.centerY',
};
const LABEL_FOR: Record<AlignEdge, string> = {
  'left': 'Align Left',
  'right': 'Align Right',
  'top': 'Align Top',
  'bottom': 'Align Bottom',
  'center-x': 'Align Centers Horizontally',
  'center-y': 'Align Centers Vertically',
};
const ICON_FOR: Record<AlignEdge, ReactNode> = {
  'left': <AlignLeftIcon />,
  'right': <AlignRightIcon />,
  'top': <AlignTopIcon />,
  'bottom': <AlignBottomIcon />,
  'center-x': <AlignCenterXIcon />,
  'center-y': <AlignCenterYIcon />,
};

// ---------------------------------------------------------------------------
// Shared helper for descriptor invokers
// ---------------------------------------------------------------------------

/**
 * Apply an align operation to the current selection via the Scene API.
 * Uses the kit's default rect-pose geometry so the descriptor works for
 * any axis-aligned rect pose without consumer geometry config.
 */
function alignSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  edge: AlignEdge,
): void {
  const ids = selection.get();
  if (ids.length < 2) return;
  const geom = RECT_POSE_DESCRIPTOR as unknown as PoseProjection<unknown>;
  const poses = ids.map((id) => {
    const node = scene.get(id);
    return node?.pose ?? { x: 0, y: 0, width: 0, height: 0 };
  });
  const bounds = poses.map((p) => geom.getBounds(p) as ResizePose);
  // Guarded non-empty by `ids.length < 2` above → `!` is safe.
  const union = unionBounds(bounds)!;
  scene.batch('Align', () => {
    for (let i = 0; i < ids.length; i++) {
      const { dx, dy } = alignDeltaFor(bounds[i], union, edge);
      if (dx === 0 && dy === 0) continue;
      const to = translatePoseViaDescriptor(poses[i], dx, dy, geom);
      scene.setPose(ids[i], to);
    }
  });
}

// ---------------------------------------------------------------------------
// Static descriptors
// ---------------------------------------------------------------------------

function makeAlignAction(edge: AlignEdge): Action {
  return {
    id: ID_FOR[edge],
    label: LABEL_FOR[edge],
    icon: ICON_FOR[edge],
    group: 'align',
    eligible: { capability: 'transforms-selection' },
    // No default keybindings — six edges/centers don't fit a clean default
    // chord set. Wire bindings explicitly via the actions registry override map.
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const selection = deps.selection as SelectionApi | undefined;
        const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
        if (!selection || !scene) return;
        alignSelection(selection, scene, edge);
      },
    } satisfies ImmediateInvoker,
    enabled: () => ActionDisabledReason.SelectionRequired,
  };
}

/** @experimental Static descriptor for align-left. */
export const alignLeftAction    = makeAlignAction('left');
/** @experimental Static descriptor for align-right. */
export const alignRightAction   = makeAlignAction('right');
/** @experimental Static descriptor for align-top. */
export const alignTopAction     = makeAlignAction('top');
/** @experimental Static descriptor for align-bottom. */
export const alignBottomAction  = makeAlignAction('bottom');
/** @experimental Static descriptor for align-center-x. */
export const alignCenterXAction = makeAlignAction('center-x');
/** @experimental Static descriptor for align-center-y. */
export const alignCenterYAction = makeAlignAction('center-y');

