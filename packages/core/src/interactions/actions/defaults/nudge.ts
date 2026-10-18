import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { Affine } from '@weasel-js/geom';
import { createTransformOp } from 'core/ops/transform';
import type { PoseDescriptor } from '../resize/geometry';
import { translatePoseViaDescriptor } from '../resize/geometry';
import { nodeDescriptors, poseDescriptorOf } from '../poseDescriptorDep';
import type { Action } from '@weasel-js/routing';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { requiresSelection } from './requiresSelection';
import { geometryDataOp, type GeometryProjection } from '../geometryProjection';
import { scenePoseFrame } from '../poseFrame';
import { moveSources, storedDelta, translateTargets } from '../selectionSubtree';
import { NUDGE_KEY, NUDGE_LABEL, nudgeDelta, type NudgeDirection } from './nudgeSteps';
import { recordTransform } from '../transform-again/memory';

/**
 * Apply a world translation of (dx, dy) to the selected nodes and the
 * descendants that do not ride on one of them, as one undo entry labeled
 * `label` — on screen, the way a drag moves them, whatever frame each is
 * stored in. Translates through the `poseDescriptor` dep, so any pose shape
 * moves. Returns whether anything moved.
 */
export function translateSelection(
  selection: Pick<SelectionApi, 'get' | 'adapterMethods'>,
  scene: Scene<unknown, string, unknown>,
  dx: number,
  dy: number,
  applyOps: ((ops: Op[], label: string) => void) | undefined,
  geometryProjection: GeometryProjection | undefined,
  d: PoseDescriptor<unknown>,
  label = 'Nudge',
): boolean {
  const descriptorOf = nodeDescriptors(scene, d);
  const frame = scenePoseFrame(scene);
  const ids = translateTargets(scene, frame, moveSources(scene, selection.get()));
  if (ids.length === 0) return false;

  const ops: Op[] = [];
  for (const id of ids) {
    const node = scene.get(id);
    if (!node) continue;
    const l = storedDelta(frame, descriptorOf(id), id, dx, dy);
    // Pushed alongside each transform op so a wired geometryProjection moves
    // the node's data-held geometry too.
    const m: Affine = [1, 0, 0, 1, l.dx, l.dy];
    ops.push(createTransformOp<unknown>({
      id: id as string,
      from: node.pose,
      to: translatePoseViaDescriptor(node.pose, l.dx, l.dy, descriptorOf(id)),
      label,
    }));
    const dataOp = geometryDataOp(
      geometryProjection,
      { id: id as string, data: node.data, pose: node.pose },
      m,
      label,
    );
    if (dataOp) ops.push(dataOp);
  }
  if (ops.length === 0) return false;

  if (applyOps) applyOps(ops, label);
  else scene.applyBatch(ops, label, defaultCommitAdapter(scene, selection.adapterMethods));
  return true;
}

/**
 * The nudge descriptor for one direction: bare arrow (magnitude='small') and
 * Shift+arrow (magnitude='big').
 */
function makeNudgeAction(dir: NudgeDirection): Action & { requires: string[] } {
  return {
    id: `nudge.${dir}`,
    label: `Nudge ${NUDGE_LABEL[dir]}`,
    group: 'nudge',
    defaultBinding: [
      { spec: { kind: 'key', key: NUDGE_KEY[dir] },                              opts: { params: { magnitude: 'small' } } },
      { spec: { kind: 'key', key: NUDGE_KEY[dir], mods: { shift: true } }, opts: { params: { magnitude: 'big' } } },
    ],
    eligible: { capability: 'transforms-selection' },
    requires: ['selection', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const { dx, dy } = nudgeDelta(dir, params?.magnitude);
        const selection = deps.selection;
        const scene = deps.scene;
        const applyOps = deps.applyOps;
        const geometryProjection = deps.geometryProjection;
        if (!selection || !scene) return;
        if (translateSelection(selection, scene, dx, dy, applyOps, geometryProjection, poseDescriptorOf(deps.poseDescriptor))) {
          recordTransform(scene, { kind: 'translate', dx, dy }, selection.get());
        }
      },
    },
    enabled: requiresSelection,
  };
}

export const nudgeUpAction    = makeNudgeAction('up');
export const nudgeDownAction  = makeNudgeAction('down');
export const nudgeLeftAction  = makeNudgeAction('left');
export const nudgeRightAction = makeNudgeAction('right');
