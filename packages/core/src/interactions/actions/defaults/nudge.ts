import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { PoseDescriptor } from '../resize/geometry';
import { poseDescriptorOf } from '../poseDescriptorDep';
import { ActionDisabledReason, type Action } from '@weasel-js/routing';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { transformApplyOps } from '../transformFinish';
import { requiresSelection } from './requiresSelection';
import type { GeometryProjection } from '../geometryProjection';
import { moveNodesOps } from '../moveNodes';
import { nudgeSpec, NUDGE_LABEL, nudgeDelta, type NudgeDirection } from './nudgeSteps';
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
  applyOps: ((ops: Op[], label: string) => boolean | void) | undefined,
  geometryProjection: GeometryProjection | undefined,
  d: PoseDescriptor<unknown>,
  label = 'Nudge',
): boolean {
  const ops = moveNodesOps(scene, selection.get() as readonly string[], { dx, dy }, { poseDescriptor: d, geometryProjection }, label);
  if (ops.length === 0) return false;

  if (!applyOps) return scene.applyBatch(ops, label, defaultCommitAdapter(scene, selection.adapterMethods));
  return applyOps(ops, label) !== false;
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
      { spec: nudgeSpec(dir, false), opts: { id: `nudge.${dir}.small`, params: { magnitude: 'small' } } },
      { spec: nudgeSpec(dir, true), opts: { id: `nudge.${dir}.big`, params: { magnitude: 'big' } } },
    ],
    eligible: { capability: 'transforms-selection' },
    requires: ['selection', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor', 'transformFollowers'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const { dx, dy } = nudgeDelta(dir, params?.magnitude);
        const selection = deps.selection;
        const scene = deps.scene;
        const applyOps = transformApplyOps(deps);
        const geometryProjection = deps.geometryProjection;
        if (!selection || !scene) return;
        if (translateSelection(selection, scene, dx, dy, applyOps, geometryProjection, poseDescriptorOf(deps.poseDescriptor))) {
          recordTransform(scene, { kind: 'translate', dx, dy }, selection.get());
        }
      },
    },
    // On while some selected node would move: a step rounding absorbs moves nothing (2026-11-10 ruling).
    enabled: (deps, _at, _carried, params) => {
      const given = requiresSelection(deps);
      if (given !== true || !deps?.scene) return given;
      const { dx, dy } = nudgeDelta(dir, params?.magnitude);
      const ops = moveNodesOps(deps.scene, deps.selection!.get() as readonly string[], { dx, dy }, deps, 'Nudge');
      return ops.length > 0 ? true : ActionDisabledReason.NotApplicable;
    },
  };
}

export const nudgeUpAction    = makeNudgeAction('up');
export const nudgeDownAction  = makeNudgeAction('down');
export const nudgeLeftAction  = makeNudgeAction('left');
export const nudgeRightAction = makeNudgeAction('right');
