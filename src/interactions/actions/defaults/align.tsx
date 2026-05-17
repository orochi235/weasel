import type { ReactNode } from 'react';
import type { Scene } from 'core/scene/types';
import type { PoseDescriptor } from '../resize/geometry';
import { RECT_POSE_DESCRIPTOR } from '../resize/geometry';
import type { ResizePose } from '../../gestures/types';
import { alignDeltaFor, translatePoseViaDescriptor, type AlignEdge } from '../align/align';
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

function unionBounds(rs: ResizePose[]): ResizePose {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rs) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

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
  const geom = RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<unknown>;
  const poses = ids.map((id) => {
    const node = scene.get(id);
    return node?.pose ?? { x: 0, y: 0, width: 0, height: 0 };
  });
  const bounds = poses.map((p) => geom.getBounds(p) as ResizePose);
  const union = unionBounds(bounds);
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
// Static descriptors (Phase 4+)
// ---------------------------------------------------------------------------

function makeAlignAction(edge: AlignEdge): Action {
  return {
    id: ID_FOR[edge],
    label: LABEL_FOR[edge],
    icon: ICON_FOR[edge],
    group: 'align',
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

/** @experimental Static descriptor for align-left (Phase 4+). */
export const alignLeftAction    = makeAlignAction('left');
/** @experimental Static descriptor for align-right (Phase 4+). */
export const alignRightAction   = makeAlignAction('right');
/** @experimental Static descriptor for align-top (Phase 4+). */
export const alignTopAction     = makeAlignAction('top');
/** @experimental Static descriptor for align-bottom (Phase 4+). */
export const alignBottomAction  = makeAlignAction('bottom');
/** @experimental Static descriptor for align-center-x (Phase 4+). */
export const alignCenterXAction = makeAlignAction('center-x');
/** @experimental Static descriptor for align-center-y (Phase 4+). */
export const alignCenterYAction = makeAlignAction('center-y');

