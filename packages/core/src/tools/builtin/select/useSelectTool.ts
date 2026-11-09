import type { WorldPoint } from '@weasel-js/routing';
import { pickWalk, adapterPickSource, scenePlaneOf } from 'canvas/pickWalk';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Tool } from '../../overlayBinding';
import { adapterPointQuery } from './adapterPointQuery';
import { centersBetween } from './centersBetween';
import { useSelectToolWith, type SelectAdapter, type UseSelectToolOptions } from './useSelectToolWith';

export { useSelectToolWith, MULTI_RESIZE_TARGET_ID } from './useSelectToolWith';
export type { Bounds, SelectAdapter, UseSelectToolOptions } from './useSelectToolWith';

/** The kit's picker for a bare adapter: a walk of its tree, each leaf tested
 *  against its pose box, or its painted silhouette under
 *  `leafPicking: 'silhouette'`. */
function adapterPickEvery<TNode extends { id: string }, TPose>(
  adapter: SelectAdapter<TNode, TPose>,
  options: UseSelectToolOptions<TPose>,
): (world: WorldPoint) => string[] {
  const d = (options.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const query = adapterPointQuery(d, options.leafPicking === 'silhouette');
  const tolerance = options.pickTolerance ?? 0;
  return (world) => {
    const camera = options.getView?.() ?? null;
    const planeOf = camera ? scenePlaneOf(adapter.getLayers?.(), camera) : null;
    return pickWalk<TPose>(adapterPickSource(adapter, {
      ...(options.alphaOf ? { alphaOf: options.alphaOf } : {}),
      ...(options.layerIsPainted ? { layerIsPainted: options.layerIsPainted } : {}),
      ...(planeOf ? { planeOf } : {}),
    }), query(world.x, world.y, tolerance));
  };
}

/** The kit's range for a bare adapter: every node whose center lies in the box the two ends span. */
function adapterBetween<TNode extends { id: string }, TPose>(
  adapter: SelectAdapter<TNode, TPose>,
  options: UseSelectToolOptions<TPose>,
): (from: string, to: string) => string[] {
  return centersBetween<TPose>(adapter, (options.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>, {
    ...(options.alphaOf ? { alphaOf: options.alphaOf } : {}),
    ...(options.layerIsPainted ? { layerIsPainted: options.layerIsPainted } : {}),
  });
}

/** The select tool: {@link useSelectToolWith} with `options.pickEvery` and `options.between`, or
 *  the kit's adapter walks where they are omitted. */
export function useSelectTool<TNode extends { id: string }, TPose>(
  adapter: SelectAdapter<TNode, TPose>,
  options: UseSelectToolOptions<TPose>,
): Tool {
  return useSelectToolWith(adapter, {
    ...options,
    pickEvery: options.pickEvery ?? adapterPickEvery(adapter, options),
    between: options.between ?? adapterBetween(adapter, options),
  });
}
