import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { Mat3 } from '@weasel-js/geom';
import { createTransformOp } from 'core/ops/transform';
import type { PoseDescriptor } from '../resize/geometry';
import { translatePoseViaDescriptor } from '../resize/geometry';
import { poseDescriptorOf } from '../poseDescriptorDep';
import type { Action } from '@weasel-js/routing';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { requiresSelection } from './requiresSelection';
import { geometryDataOp, type GeometryProjection } from '../geometryProjection';
import { scenePoseFrame } from '../poseFrame';
import { moveSources, translateTargets } from '../selectionSubtree';
import { NUDGE_KEY, NUDGE_LABEL, nudgeDelta, type NudgeDirection } from './nudgeSteps';

/**
 * Apply a translation of (dx, dy) to the selected nodes and the descendants
 * that do not ride on one of them, by building one `createTransformOp` per
 * node (from = pre-mutation pose, to = nudged pose) and routing the batch
 * through the consumer commit hook. Translates through the `poseDescriptor`
 * dep, so any pose shape moves.
 *
 * Mirrors `moveAction`'s `commitOps` helper: when `deps.applyOps` is present
 * the ops route through the consumer's history (one undo entry there);
 * otherwise they apply straight to the scene's own history via
 * `scene.applyBatch` + `defaultCommitAdapter`. Either way the whole nudge is a
 * single batch → one undo entry, preserving the old `scene.batch('Nudge', …)`
 * semantics exactly.
 */
function nudgeSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  dx: number,
  dy: number,
  applyOps: ((ops: Op[], label: string) => void) | undefined,
  geometryProjection: GeometryProjection | undefined,
  d: PoseDescriptor<unknown>,
  poseComposition: unknown,
): void {
  const ids = translateTargets(
    scene, scenePoseFrame(scene, poseComposition), moveSources(scene, selection.get()),
  );
  if (ids.length === 0) return;
  // Pure translation by the nudge step. Pushed alongside each transform op so
  // a wired geometryProjection mirrors the node's data-held geometry too.
  const m: Mat3 = [1, 0, 0, 1, dx, dy];

  // Read poses BEFORE building ops so each op's `from` is the pre-mutation
  // value (the same value the old direct mutation captured implicitly).
  const ops: Op[] = [];
  for (const id of ids) {
    const node = scene.get(id);
    if (!node) continue;
    ops.push(createTransformOp<unknown>({
      id: id as string,
      from: node.pose,
      to: translatePoseViaDescriptor(node.pose, dx, dy, d),
      label: 'Nudge',
    }));
    const dataOp = geometryDataOp(
      geometryProjection,
      { id: id as string, data: node.data, pose: node.pose },
      m,
      'Nudge',
    );
    if (dataOp) ops.push(dataOp);
  }
  if (ops.length === 0) return;

  if (applyOps) applyOps(ops, 'Nudge');
  else scene.applyBatch(ops, 'Nudge', defaultCommitAdapter(scene, selection.adapterMethods));
}

/**
 * @experimental
 * Build one static nudge descriptor for the given direction. Each descriptor
 * carries two parametric bindings: bare arrow (magnitude='small') and
 * Shift+arrow (magnitude='big').
 *
 * Requires dep-schema entries: `selection`, `scene`.
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
    requires: ['selection', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor', 'poseComposition'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const { dx, dy } = nudgeDelta(dir, params?.magnitude);
        const selection = deps.selection;
        const scene = deps.scene;
        const applyOps = deps.applyOps;
        const geometryProjection = deps.geometryProjection;
        if (!selection || !scene) return;
        nudgeSelection(selection, scene, dx, dy, applyOps, geometryProjection, poseDescriptorOf(deps.poseDescriptor), deps.poseComposition);
      },
    },
    enabled: requiresSelection,
  };
}

export const nudgeUpAction    = makeNudgeAction('up');
export const nudgeDownAction  = makeNudgeAction('down');
export const nudgeLeftAction  = makeNudgeAction('left');
export const nudgeRightAction = makeNudgeAction('right');
