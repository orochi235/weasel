import type { WorldPoint } from '@weasel-js/routing';
import { pickWalk, adapterPickSource, createLayerPlaneLookup, centersBetween } from '@weasel-js/core';
import { AUTO_POSE_DESCRIPTOR } from '@weasel-js/core/engine';
import type { PoseDescriptor } from '@weasel-js/core/engine';
import type { Tool } from '@weasel-js/core';
import { adapterPointQuery } from './adapterPointQuery';
import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { createPickerSelectTool, type SelectAdapter, type UseSelectToolOptions } from './usePickerSelectTool';

export { createPickerSelectTool, usePickerSelectTool } from './usePickerSelectTool';
export type { SelectAdapter, UseSelectToolOptions } from './usePickerSelectTool';

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
    const planeOf = camera ? createLayerPlaneLookup(adapter.getLayers?.(), camera) : null;
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

/** The select tool: {@link createPickerSelectTool} with `options().pickEvery` and `options().between`, or the kit's
 *  adapter walks where they are omitted, read live. */
export function createSelectTool<TNode extends { id: string }, TPose>(
  adapter: () => SelectAdapter<TNode, TPose>,
  options: () => UseSelectToolOptions<TPose>,
): Tool {
  return createPickerSelectTool(adapter, () => {
    const o = options();
    const a = adapter();
    return { ...o, pickEvery: o.pickEvery ?? adapterPickEvery(a, o), between: o.between ?? adapterBetween(a, o) };
  });
}

/** {@link createSelectTool} for the life of the calling component, reading `adapter` and `options` live. */
export function useSelectTool<TNode extends { id: string }, TPose>(
  adapter: SelectAdapter<TNode, TPose>,
  options: UseSelectToolOptions<TPose>,
): Tool {
  const liveAdapter = useLatest(adapter);
  const liveOptions = useLatest(options);
  return useMemo(() => createSelectTool(() => liveAdapter.current, () => liveOptions.current), [liveAdapter, liveOptions]);
}
