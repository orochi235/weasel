import type { Scene } from 'core/scene/types';
import type { PoseProjection } from '../resize/geometry';
import { RECT_POSE_DESCRIPTOR } from '../resize/geometry';
import {
  flipPoseViaDescriptor,
  type FlipAxis,
} from '../flip/helpers';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { SelectionApi } from 'core/selection/useSelection';

/**
 * Flip the current selection in `scene` along `axis`, using the kit's default
 * rect geometry. Called from `flipAction.invoker.run`; uses `scene.batch` +
 * `scene.setPose` so it goes through the scene's own undoable mutation path.
 *
 * Pivot: always `'each'` (per-item own AABB) for the static descriptor path.
 */
function flipSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  axis: FlipAxis,
): void {
  const ids = selection.get();
  if (ids.length === 0) return;
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
      if (!selection || !scene) return;
      flipSelection(selection, scene, axis);
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
