import type { ReactNode } from 'react';
import type { Scene } from 'core/scene/types';
import type { PoseDescriptor } from '../resize/geometry';
import { poseDescriptorOf } from '../poseDescriptorDep';
import {
  alignDeltaFor,
  alignTargetBounds,
  translatePoseViaDescriptor,
  visualBoundsViaDescriptor,
  type AlignEdge,
  type AlignReference,
} from '../align/align';
import { actionReferenceSources } from '../spatialReference';
import type { PointerContextValue } from 'features/pointer/PointerContext';
import { scenePoseFrame } from '../poseFrame';
import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { SelectionApi } from 'core/selection/useSelection';
import type { ImmediateInvoker } from '@weasel-js/routing';
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
 * Reads poses through the `poseDescriptor` dep; what the selection aligns to
 * comes from `params.to` (an `AlignReference`, default `'union'`).
 *
 * The edge every member lines up on is a world edge, so the bounds are read
 * and translated in world and each result is stored back in its own parent's
 * frame.
 */
function alignSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  edge: AlignEdge,
  geom: PoseDescriptor<unknown>,
  poseComposition: unknown,
  params: Record<string, unknown> | undefined,
  pointer: PointerContextValue | undefined,
): void {
  const ids = selection.get();
  const frame = scenePoseFrame(scene, poseComposition);
  const poses = ids.map((id) => frame.world(id));
  const bounds = poses.map((p) => visualBoundsViaDescriptor(p, geom));
  const target = alignTargetBounds(
    bounds,
    params?.to as AlignReference | undefined,
    actionReferenceSources(params, pointer, scene, frame, geom),
  );
  if (target === null) return;
  scene.batch('Align', () => {
    for (let i = 0; i < ids.length; i++) {
      const { dx, dy } = alignDeltaFor(bounds[i], target, edge);
      if (dx === 0 && dy === 0) continue;
      const to = translatePoseViaDescriptor(poses[i], dx, dy, geom);
      scene.setPose(ids[i], frame.local(ids[i], to));
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
    requires: ['selection', 'scene', 'poseDescriptor', 'poseComposition', 'pointer'],
    // No default keybindings — six edges/centers don't fit a clean default
    // chord set. Wire bindings explicitly via the actions registry override map.
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const selection = deps.selection as SelectionApi | undefined;
        const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
        if (!selection || !scene) return;
        alignSelection(
          selection, scene, edge, poseDescriptorOf(deps.poseDescriptor), deps.poseComposition,
          params, deps.pointer as PointerContextValue | undefined,
        );
      },
    } satisfies ImmediateInvoker,
    // One item is enough: `enabled` cannot see the binding's `to`, and every
    // reference but `'union'` aligns a single item. Deps-aware, since a
    // constant disabled reason greys the entry out forever (see
    // `requiresSelection`).
    enabled: (deps) => {
      const selection = deps?.selection as SelectionApi | undefined;
      const count = selection?.get().length ?? 0;
      return count >= 1 ? true : ActionDisabledReason.SelectionRequired;
    },
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

