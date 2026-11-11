import type { IconRef } from '@weasel-js/icons';
import type { Scene } from 'core/scene/types';
import {
  alignDeltaFor,
  alignTargetBounds,
  type AlignEdge,
  type AlignReference,
} from './align';
import { actionReferenceSources } from '../spatialReference';
import { scenePoseFrame } from '../poseFrame';
import type { Op } from 'core/ops/types';
import { drawnBoxes } from '../drawnBoxes';
import { moveEachOps } from '../moveNodes';
import { uncarried } from '../selectionSubtree';
import { withoutPageStructure } from 'core/scene/nodeGates';
import { commitTransformOps } from '../transformFinish';
import type { Action, ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { SelectionApi } from 'core/selection/useSelection';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { icon } from '../../../icons.gen';
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
const ICON_FOR: Record<AlignEdge, IconRef> = {
  'left': icon('alignLeft'),
  'right': icon('alignRight'),
  'top': icon('alignTop'),
  'bottom': icon('alignBottom'),
  'center-x': icon('alignCenterX'),
  'center-y': icon('alignCenterY'),
};

// ---------------------------------------------------------------------------
// Shared helper for descriptor invokers
// ---------------------------------------------------------------------------

/**
 * The ops an align of the current selection commits, read through the
 * `poseDescriptor` dep; what the selection aligns to comes from `params.to`
 * (an `AlignReference`, default `'union'`). Empty when nothing would move.
 *
 * The edge every member lines up on is a world edge, so the bounds are read
 * and translated in world and each result is stored back in its own parent's
 * frame.
 */
function alignOps(
  deps: ActionDeps,
  selection: Pick<SelectionApi, 'get'>,
  scene: Scene<unknown, string, unknown>,
  edge: AlignEdge,
  params: Readonly<Record<string, unknown>> | undefined,
): Op[] {
  const frame = scenePoseFrame(scene);
  const ids = uncarried(frame, withoutPageStructure(scene, selection.get()));
  const boxes = drawnBoxes(deps, frame);
  const poses = ids.map((id) => frame.world(id));
  const bounds = poses.map((p, i) => boxes.aabb(ids[i]!, p));
  const target = alignTargetBounds(
    bounds,
    params?.to as AlignReference | undefined,
    actionReferenceSources(params as Record<string, unknown> | undefined, deps.pointer, scene, frame, boxes),
  );
  if (target === null) return [];
  const moves = ids.map((id, i) => ({ ids: [id], ...alignDeltaFor(bounds[i], target, edge) }));
  return moveEachOps(scene, moves, deps, 'Align');
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
    requires: ['selection', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor', 'pointer', 'view', 'boundsIncludeStroke', 'drawnBoxes', 'transformFollowers'],
    // No default keybindings — six edges/centers don't fit a clean default
    // chord set. Wire bindings explicitly via the actions registry override map.
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const selection = deps.selection;
        const scene = deps.scene;
        if (!selection || !scene) return;
        commitTransformOps(deps, alignOps(deps, selection, scene, edge, params), 'Align');
      },
    } satisfies ImmediateInvoker,
    enabled: (deps, _at, _carried, params) => {
      const selection = deps?.selection;
      const scene = deps?.scene;
      if (!selection || !scene || selection.get().length === 0) return ActionDisabledReason.SelectionRequired;
      return alignOps(deps, selection, scene, edge, params).length > 0 ? true : ActionDisabledReason.NotApplicable;
    },
  };
}

/** Static descriptor for align-left. */
export const alignLeftAction    = makeAlignAction('left');
/** Static descriptor for align-right. */
export const alignRightAction   = makeAlignAction('right');
/** Static descriptor for align-top. */
export const alignTopAction     = makeAlignAction('top');
/** Static descriptor for align-bottom. */
export const alignBottomAction  = makeAlignAction('bottom');
/** Static descriptor for align-center-x. */
export const alignCenterXAction = makeAlignAction('center-x');
/** Static descriptor for align-center-y. */
export const alignCenterYAction = makeAlignAction('center-y');

