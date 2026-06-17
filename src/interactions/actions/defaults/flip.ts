import type { Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import type { PoseProjection } from '../resize/geometry';
import { RECT_POSE_DESCRIPTOR } from '../resize/geometry';
import {
  flipPoseViaDescriptor,
  type FlipAxis,
} from '../flip/helpers';
import type { Action } from '../registry';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { requiresSelection } from './requiresSelection';
import type { SelectionApi } from 'core/selection/useSelection';

/**
 * Flip the current selection in `scene` along `axis`, using the kit's default
 * rect geometry. Called from `flipAction.invoker.run`.
 *
 * Builds one `createTransformOp` per selected node (from = pre-flip pose,
 * to = flipped pose) and routes the batch through the consumer commit hook.
 * Mirrors `moveAction`/`nudge`'s `commitOps` helper: when `deps.applyOps` is
 * present the ops route through the consumer's history (one undo entry there);
 * otherwise they apply straight to the scene's own history via
 * `scene.applyBatch` + `defaultCommitAdapter`. Either way the whole flip is a
 * single batch → one undo entry, preserving the old `scene.batch('Flip', …)`
 * semantics exactly.
 *
 * Pivot: always `'each'` (per-item own AABB) for the static descriptor path.
 */
function flipSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  axis: FlipAxis,
  applyOps?: (ops: Op[], label: string) => void,
): void {
  const ids = selection.get();
  if (ids.length === 0) return;
  const geom = RECT_POSE_DESCRIPTOR as unknown as PoseProjection<unknown>;

  // Read poses BEFORE building ops so each op's `from` is the pre-flip value
  // (the same value the old direct mutation captured implicitly).
  const ops: Op[] = [];
  for (const id of ids) {
    const node = scene.get(id);
    if (!node) continue;
    ops.push(createTransformOp<unknown>({
      id: id as string,
      from: node.pose,
      to: flipPoseViaDescriptor(node.pose, axis, geom),
      label: 'Flip',
    }));
  }
  if (ops.length === 0) return;

  if (applyOps) applyOps(ops, 'Flip');
  else scene.applyBatch(ops, 'Flip', defaultCommitAdapter(scene));
}

/**
 * @experimental
 * Static descriptor for the unified `flip` Action.
 *
 * Collapses the old `flip.horizontal` and `flip.vertical` pair into one action
 * with two parametric gesture bindings. The axis (`'x'` | `'y'`) is carried in
 * `opts.params.axis` and forwarded to `invoker.run` by the dispatcher.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 */
export const flipAction: Action & { requires: string[] } = {
  id: 'flip',
  label: 'Flip',
  defaultBinding: [
    { spec: { kind: 'key', key: ['h', 'H'], mods: { shift: true } }, opts: { params: { axis: 'x' } } },
    { spec: { kind: 'key', key: ['v', 'V'], mods: { shift: true } }, opts: { params: { axis: 'y' } } },
  ],
  eligible: { capability: 'transforms-selection' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const axis = (params?.axis as FlipAxis | undefined) ?? 'x';
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      const applyOps = deps.applyOps as ((ops: Op[], label: string) => void) | undefined;
      if (!selection || !scene) return;
      flipSelection(selection, scene, axis, applyOps);
    },
  },
  enabled: requiresSelection,
};
