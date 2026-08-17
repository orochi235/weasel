import type { Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { Mat3 } from '@weasel-js/geom';
import { createTransformOp } from 'core/ops/transform';
import type { PoseProjection } from '../resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from '../resize/autoPoseDescriptor';
import {
  flipPoseAboutBounds,
  flipPoseViaDescriptor,
  type FlipAxis,
  type FlipPivot,
} from '../flip/helpers';
import { unionBounds } from 'features/groups/unionBounds';
import type { Action } from '../registry';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { requiresSelection } from './requiresSelection';
import type { SelectionApi } from 'core/selection/useSelection';
import { geometryDataOp, type GeometryProjection } from '../geometryProjection';

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
 * Pivot: `'each'` (per-item own AABB) unless the caller passes `'union'`,
 * which mirrors every pose about the selection's union AABB so items swap
 * sides as well as reflect.
 */
function flipSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  axis: FlipAxis,
  pivot: FlipPivot,
  applyOps?: (ops: Op[], label: string) => void,
  geometryProjection?: GeometryProjection,
): void {
  const ids = selection.get();
  if (ids.length === 0) return;
  const geom = AUTO_POSE_DESCRIPTOR as unknown as PoseProjection<unknown>;

  const nodes = ids.map((id) => scene.get(id)).filter((n) => n != null);
  const unionPivot = pivot === 'union'
    ? unionBounds(nodes.map((n) => geom.getBounds(n.pose)))
    : null;

  // Read poses BEFORE building ops so each op's `from` is the pre-flip value
  // (the same value the old direct mutation captured implicitly).
  const ops: Op[] = [];
  for (const id of ids) {
    const node = scene.get(id);
    if (!node) continue;
    ops.push(createTransformOp<unknown>({
      id: id as string,
      from: node.pose,
      to: unionPivot
        ? flipPoseAboutBounds(node.pose, axis, geom, unionPivot)
        : flipPoseViaDescriptor(node.pose, axis, geom),
      label: 'Flip',
    }));
    // Mirror the data-held geometry about the SAME pivot the pose flip uses,
    // so a wired geometryProjection reflects the contents in lock-step with
    // the frame. A pose-only flip of a bare-AABB pose is identity, so this
    // data op is the only way an asymmetric shape actually mirrors.
    const g = unionPivot ?? geom.getBounds(node.pose);
    const cx = g.x + g.width / 2;
    const cy = g.y + g.height / 2;
    const m: Mat3 = axis === 'x' ? [-1, 0, 0, 1, 2 * cx, 0] : [1, 0, 0, -1, 0, 2 * cy];
    const dataOp = geometryDataOp(
      geometryProjection,
      { id: id as string, data: node.data, pose: node.pose },
      m,
      'Flip',
    );
    if (dataOp) ops.push(dataOp);
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
 * `opts.params.axis` and forwarded to `invoker.run` by the dispatcher, as is
 * the optional `opts.params.pivot` (`'each'` | `'union'`, default `'each'`).
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
  requires: ['selection', 'scene', 'applyOps', 'geometryProjection'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const axis = (params?.axis as FlipAxis | undefined) ?? 'x';
      const pivot = (params?.pivot as FlipPivot | undefined) ?? 'each';
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      const applyOps = deps.applyOps as ((ops: Op[], label: string) => void) | undefined;
      const geometryProjection = deps.geometryProjection as GeometryProjection | undefined;
      if (!selection || !scene) return;
      flipSelection(selection, scene, axis, pivot, applyOps, geometryProjection);
    },
  },
  enabled: requiresSelection,
};
