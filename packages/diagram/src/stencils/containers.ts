import { icon } from '../icons.gen';
import type { ContainerStencil } from '../containers/containerStencils';
import type { StencilGroup } from '../diagramTypes/types';

/** A titled box, and pools of rows and of columns. */
export const CONTAINER_STENCILS: readonly ContainerStencil[] = [
  { id: 'container', label: 'Container', role: 'container', size: { width: 240, height: 160 }, icon: icon('container') },
  { id: 'pool-rows', label: 'Pool (rows)', role: 'pool', axis: 'y', size: { width: 480, height: 240 }, icon: icon('poolRows') },
  { id: 'pool-columns', label: 'Pool (columns)', role: 'pool', axis: 'x', size: { width: 480, height: 300 }, icon: icon('poolColumns') },
];

/** The containers as a stencil group. */
export const CONTAINERS_GROUP: StencilGroup = { id: 'containers', label: 'Containers', stencils: CONTAINER_STENCILS };
