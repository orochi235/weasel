import type { ContainerStencil } from '../containers/containerStencils';
import { icon } from '../icons.gen';
import { BPMN_GROUP } from '../stencils/bpmn';
import { CONTAINERS_GROUP } from '../stencils/containers';
import { FLOWCHART_GROUP } from '../stencils/flowchart';
import { NETWORK_GROUP } from '../stencils/network';
import { MIND_MAP_GROUP } from '../stencils/mindMap';
import { ORG_GROUP } from '../stencils/org';
import { ERD_GROUP } from '../stencils/erd';
import { UML_GROUP } from '../stencils/uml';
import type { DiagramStencil } from '../stencil';
import { FLOWCHART_NOTATION, type DiagramType, type StencilGroup } from './types';

const byId = <T extends { id: string }>(list: readonly T[]): Readonly<Record<string, T>> =>
  Object.freeze(Object.fromEntries(list.map((item) => [item.id, item])));

/** The stencil groups this package ships, by id, in menu order. */
export const STENCIL_GROUPS: Readonly<Record<string, StencilGroup>> = byId([
  FLOWCHART_GROUP, CONTAINERS_GROUP,
  ORG_GROUP, NETWORK_GROUP, BPMN_GROUP, UML_GROUP, ERD_GROUP, MIND_MAP_GROUP,
]);

/** The flowchart: its symbols and containers, connectors as the theme draws them, no auto layout. */
export const FLOWCHART_TYPE: DiagramType = {
  id: 'flowchart',
  label: 'Flowchart',
  icon: icon('shape:diamond'),
  groups: [FLOWCHART_GROUP.id, CONTAINERS_GROUP.id],
  notations: [FLOWCHART_NOTATION],
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

/** An org chart: cards joined by unmarked orthogonal connectors, laid out top-down as a tree. */
export const ORG_CHART_TYPE: DiagramType = {
  id: 'orgChart',
  label: 'Org chart',
  icon: icon('orgChart'),
  groups: [ORG_GROUP.id, CONTAINERS_GROUP.id],
  edge: { router: 'orthogonal', markerEnd: null },
  layout: 'tree',
};

/** A mind map: topics joined by unmarked curves, the central topic in the middle of a radial layout. */
export const MIND_MAP_TYPE: DiagramType = {
  id: 'mindMap',
  label: 'Mind map',
  icon: icon('mindMap'),
  groups: [MIND_MAP_GROUP.id],
  edge: { router: 'bezier', markerEnd: null },
  layout: 'radial',
  notations: ['mindmap'],
};

/** A UML class diagram: classes and their kin, connectors routed orthogonally to an open arrowhead. */
export const UML_CLASS_TYPE: DiagramType = {
  id: 'umlClass',
  label: 'UML class',
  icon: icon('umlClass'),
  groups: [UML_GROUP.id, CONTAINERS_GROUP.id],
  edge: { router: 'orthogonal', markerEnd: 'arrow-open' },
  notations: ['class'],
};

/** An entity-relationship diagram: connectors routed orthogonally, one at the start and many at the end. */
export const ERD_TYPE: DiagramType = {
  id: 'erd',
  label: 'Entity relationship',
  icon: icon('erdEntity'),
  groups: [ERD_GROUP.id],
  edge: { router: 'orthogonal', markerStart: 'crow-one', markerEnd: 'crow-many' },
  notations: ['er'],
};

/** The diagram types this package ships, by id, in menu order. */
export const DIAGRAM_TYPES: Readonly<Record<string, DiagramType>> = byId([
  FLOWCHART_TYPE,
  ORG_CHART_TYPE, NETWORK_TYPE, BPMN_TYPE, UML_CLASS_TYPE, ERD_TYPE, MIND_MAP_TYPE,
]);

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
