import type { NodeId, Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import type { PoseProjection } from '../resize/geometry';
import { RECT_POSE_DESCRIPTOR } from '../resize/geometry';
import {
  flipPoseAboutBounds,
  flipPoseViaDescriptor,
  type FlipAxis,
  type FlipPivot,
} from '../flip/flip';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { SelectionApi } from 'core/selection/useSelection';

/** @experimental */
export interface FlipDeps<TPose> {
  getSelection: () => NodeId[];
  getPose: (id: NodeId) => TPose;
  geometry: PoseProjection<TPose>;
  /** Static value or live thunk. Default `'each'`. */
  pivot?: FlipPivot | (() => FlipPivot);
  applyOps: (ops: Op[], label?: string) => void;
}

function readPivot<TPose>(deps: FlipDeps<TPose>): FlipPivot {
  const p = deps.pivot;
  if (p === undefined) return 'each';
  return typeof p === 'function' ? p() : p;
}

function unionAabb(rs: { x: number; y: number; width: number; height: number }[]): {
  x: number; y: number; width: number; height: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rs) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Flip the current selection in `scene` along `axis`, using the kit's default
 * rect geometry. Called from `flipAction.invoker.run`; uses `scene.batch` +
 * `scene.setPose` so it goes through the scene's own undoable mutation path.
 *
 * Pivot: always `'each'` (per-item own AABB) for the static descriptor path.
 * Consumers that need union pivot or custom geometry should use the legacy
 * `defaultFlipActions` factory, which accepts a full `FlipDeps`.
 */
function flipSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  axis: FlipAxis,
): void {
  const ids = selection.get();
  if (ids.length === 0) return;
  // Use the erased rect geometry — the dep-schema scene has unknown TPose.
  const geom = RECT_POSE_DESCRIPTOR as unknown as PoseProjection<unknown>;
  scene.batch('Flip', () => {
    for (const id of ids) {
      const node = scene.get(id);
      if (!node) continue;
      const next = flipPoseViaDescriptor(node.pose, axis, geom);
      scene.setPose(id, next);
    }
  });
}

/**
 * @experimental
 * Static descriptor for the unified `flip` Action (Phase 4+).
 *
 * Collapses the old `flip.horizontal` and `flip.vertical` pair into one action
 * with two parametric gesture bindings. The axis (`'x'` | `'y'`) is carried in
 * `opts.params.axis` and forwarded to `invoker.run` by the dispatcher.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 */
export const flipAction: Action = {
  id: 'flip',
  label: 'Flip',
  gestureBinding: [
    { spec: { kind: 'key', key: ['h', 'H'], mods: { shift: true } }, opts: { params: { axis: 'x' } } },
    { spec: { kind: 'key', key: ['v', 'V'], mods: { shift: true } }, opts: { params: { axis: 'y' } } },
  ],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const axis = (params?.axis as FlipAxis | undefined) ?? 'x';
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      if (!selection || !scene) return;
      flipSelection(selection, scene, axis);
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};

/**
 * @experimental
 * Factory for the legacy `flip.horizontal` / `flip.vertical` Action pair.
 *
 * Preserves the pre-Phase-4 two-action shape so palette / menu UIs that
 * render two distinct flip rows keep working without changes. Each bridge
 * action carries its own `defaultBinding` and `gestureBinding` for the
 * ActionsProvider legacy-keydown path.
 *
 * @deprecated Phase 4+: use `flipAction` directly. This wrapper is a
 * Phase 4–7 transition shim and will be removed in Phase 8.
 */
export function defaultFlipActions<TPose>(deps: FlipDeps<TPose>): Action[] {
  const AXES: readonly FlipAxis[] = ['x', 'y'];
  const KEY_FOR: Record<FlipAxis, string[]> = { x: ['h', 'H'], y: ['v', 'V'] };
  const ID_FOR: Record<FlipAxis, string> = { x: 'flip.horizontal', y: 'flip.vertical' };
  const LABEL_FOR: Record<FlipAxis, string> = { x: 'Flip Horizontal', y: 'Flip Vertical' };

  return AXES.map((axis): Action => ({
    id: ID_FOR[axis],
    label: LABEL_FOR[axis],
    gestureBinding: { kind: 'key', key: KEY_FOR[axis], mods: { shift: true } },
    run: () => {
      const sel = deps.getSelection();
      if (sel.length === 0) return;
      const pivot = readPivot(deps);
      const poses = sel.map((id) => deps.getPose(id));
      const unionPivot = pivot === 'union' && sel.length > 1
        ? unionAabb(poses.map((p) => deps.geometry.getBounds(p)))
        : null;
      const ops: Op[] = sel.map((id, i): Op => {
        const from = poses[i];
        const to = unionPivot
          ? flipPoseAboutBounds(from, axis, deps.geometry, unionPivot)
          : flipPoseViaDescriptor(from, axis, deps.geometry);
        return createTransformOp<TPose>({ id, from, to });
      });
      deps.applyOps(ops, 'Flip');
    },
    enabled: () => (deps.getSelection().length > 0 ? true : ActionDisabledReason.SelectionRequired),
  }));
}
