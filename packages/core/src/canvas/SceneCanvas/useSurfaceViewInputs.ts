import { useMemo } from 'react';
import type { SelectionApi } from 'core/selection/useSelection';
import type { ChromeCaps } from 'domains/chrome-caps/useChromeCaps';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { SurfaceViewInputs } from '../viewInputs';

type Picking = Pick<SurfaceViewInputs, 'boundsOf' | 'planeOfNode' | 'pickEvery' | 'pickBest' | 'kindOfNode' | 'doubleClickNames'>
  & { adapter: unknown; boundsOfPose: unknown };

/**
 * What a view needs to build its own overlay-aware state. `descriptor` is the same one handed
 * to `<Canvas>`, so the two cannot diverge.
 */
export function useSurfaceViewInputs(args: {
  picking: Picking;
  descriptor: PoseDescriptor<unknown>;
  chromeCaps: ChromeCaps;
  selection: SelectionApi;
  rotationBadge: SurfaceViewInputs['rotationBadge'];
  resizeHandles: SurfaceViewInputs['resizeHandles'];
}): SurfaceViewInputs {
  const { picking, descriptor, chromeCaps, selection, rotationBadge, resizeHandles } = args;
  const { adapter, boundsOf, boundsOfPose, planeOfNode, pickEvery, pickBest, kindOfNode, doubleClickNames } = picking;
  return useMemo<SurfaceViewInputs>(() => ({
    adapter: adapter as { getPose(id: string): unknown },
    geometry: descriptor,
    boundsOf,
    boundsOfPose: boundsOfPose as SurfaceViewInputs['boundsOfPose'],
    planeOfNode,
    pickEvery,
    pickBest,
    kindOfNode,
    doubleClickNames,
    chromeCaps,
    selectionApi: selection,
    rotationBadge,
    resizeHandles,
  }), [adapter, descriptor, boundsOf, boundsOfPose, planeOfNode,
       pickEvery, pickBest, kindOfNode, doubleClickNames, chromeCaps, selection, rotationBadge, resizeHandles]);
}
