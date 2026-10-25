import type { ContainerStencil } from '../containers/containerStencils';
import { icon } from '../icons.gen';
import { BPMN_GROUP } from '../stencils/bpmn';
import { CONTAINERS_GROUP } from '../stencils/containers';
import { FLOWCHART_GROUP } from '../stencils/flowchart';
import { NETWORK_GROUP } from '../stencils/network';
import type { DiagramStencil } from '../stencil';
import type { DiagramType, StencilGroup } from './types';

const byId = <T extends { id: string }>(list: readonly T[]): Readonly<Record<string, T>> =>
  Object.freeze(Object.fromEntries(list.map((item) => [item.id, item])));

/** The stencil groups this package ships, by id, in menu order. */
export const STENCIL_GROUPS: Readonly<Record<string, StencilGroup>> = byId([FLOWCHART_GROUP, CONTAINERS_GROUP, NETWORK_GROUP, BPMN_GROUP]);

/** The flowchart: its symbols and containers, connectors as the theme draws them, no auto layout. */
export const FLOWCHART_TYPE: DiagramType = {
  id: 'flowchart',
  label: 'Flowchart',
  icon: icon('shape:diamond'),
  groups: [FLOWCHART_GROUP.id, CONTAINERS_GROUP.id],
};

/** A network: devices joined by plain straight links. */
export const NETWORK_TYPE: DiagramType = {
  id: 'network',
  label: 'Network',
  icon: icon('router'),
  groups: [NETWORK_GROUP.id, CONTAINERS_GROUP.id],
  edge: { router: 'straight', markerEnd: null },
};

/** A BPMN process: sequence flows routed square, ending in an arrow. */
export const BPMN_TYPE: DiagramType = {
  id: 'bpmn',
  label: 'BPMN',
  icon: icon('exclusiveGateway'),
  groups: [BPMN_GROUP.id, CONTAINERS_GROUP.id],
  edge: { router: 'orthogonal', markerEnd: 'arrow' },
};

/** The diagram types this package ships, by id, in menu order. */
export const DIAGRAM_TYPES: Readonly<Record<string, DiagramType>> = byId([FLOWCHART_TYPE, NETWORK_TYPE, BPMN_TYPE]);

/** Whether `stencil` is a container's rather than a shape's. */
export const isContainerStencil = (stencil: DiagramStencil | ContainerStencil): stencil is ContainerStencil =>
  'role' in stencil;

/** Every stencil of the groups `ids` names, in their order. An id `catalog` lacks adds nothing. */
export function groupStencils(
  ids: readonly string[], catalog: Readonly<Record<string, StencilGroup>> = STENCIL_GROUPS,
): (DiagramStencil | ContainerStencil)[] {
  return ids.flatMap((id) => catalog[id]?.stencils ?? []);
}

/** The ids of `group`'s stencils. */
export const groupStencilIds = (group: StencilGroup): string[] => group.stencils.map((s) => s.id);
