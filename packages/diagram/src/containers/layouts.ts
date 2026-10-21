/**
 * The container layouts by registry key, as stable references so a saved
 * scene finds them again (`withDiagramRegistry`).
 */
import type { LayoutStrategy, RectPose } from '@weasel-js/core';
import { diagramContainerLayout } from './containerLayout';
import { laneStackLayout, poolHeader } from './laneStack';
import type { ContainerHeader, ContainerRole } from './trait';

/** A plain container's header. */
export const CONTAINER_HEADER: ContainerHeader = { side: 'top', size: 28 };
/** A lane's header depth, across its pool's stack. */
export const LANE_HEADER_SIZE = 28;

/** The header a lane of a pool stacking along `axis` has. */
export const laneHeader = (axis: 'x' | 'y'): ContainerHeader =>
  ({ side: axis === 'y' ? 'left' : 'top', size: LANE_HEADER_SIZE });

/** A titled container's layout key: free placement in the body below its header. */
export const DIAGRAM_CONTAINER_LAYOUT = 'diagram:container';
/** A pool's layout key when its lanes stack as rows, top to bottom. */
export const DIAGRAM_POOL_ROWS_LAYOUT = 'diagram:pool-rows';
/** A pool's layout key when its lanes stack as columns, left to right. */
export const DIAGRAM_POOL_COLUMNS_LAYOUT = 'diagram:pool-columns';
/** The layout key of a lane in a pool of rows: free placement beside its left header. */
export const DIAGRAM_LANE_ROWS_LAYOUT = 'diagram:lane-rows';
/** The layout key of a lane in a pool of columns: free placement below its top header. */
export const DIAGRAM_LANE_COLUMNS_LAYOUT = 'diagram:lane-columns';

/** Every container layout this package registers, by key. */
export const CONTAINER_LAYOUTS: Readonly<Record<string, LayoutStrategy<RectPose>>> = Object.freeze({
  [DIAGRAM_CONTAINER_LAYOUT]: diagramContainerLayout({ header: CONTAINER_HEADER }),
  [DIAGRAM_POOL_ROWS_LAYOUT]: laneStackLayout({ axis: 'y' }),
  [DIAGRAM_POOL_COLUMNS_LAYOUT]: laneStackLayout({ axis: 'x' }),
  [DIAGRAM_LANE_ROWS_LAYOUT]: diagramContainerLayout({ header: laneHeader('y') }),
  [DIAGRAM_LANE_COLUMNS_LAYOUT]: diagramContainerLayout({ header: laneHeader('x') }),
});

/** The layout key and header for a container of `role`; a pool or lane's
 *  follow the axis its pool stacks along. */
export function containerShape(role: ContainerRole, axis: 'x' | 'y' = 'y'): { layout: string; header: ContainerHeader } {
  if (role === 'pool') return { layout: axis === 'y' ? DIAGRAM_POOL_ROWS_LAYOUT : DIAGRAM_POOL_COLUMNS_LAYOUT, header: poolHeader(axis) };
  if (role === 'lane') return { layout: axis === 'y' ? DIAGRAM_LANE_ROWS_LAYOUT : DIAGRAM_LANE_COLUMNS_LAYOUT, header: laneHeader(axis) };
  return { layout: DIAGRAM_CONTAINER_LAYOUT, header: CONTAINER_HEADER };
}
