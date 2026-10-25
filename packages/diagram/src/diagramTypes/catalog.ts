import type { ContainerStencil } from '../containers/containerStencils';
import { icon } from '../icons.gen';
import { CONTAINERS_GROUP } from '../stencils/containers';
import { FLOWCHART_GROUP } from '../stencils/flowchart';
import { ERD_GROUP } from '../stencils/erd';
import { UML_GROUP } from '../stencils/uml';
import type { DiagramStencil } from '../stencil';
import type { DiagramType, StencilGroup } from './types';

const byId = <T extends { id: string }>(list: readonly T[]): Readonly<Record<string, T>> =>
  Object.freeze(Object.fromEntries(list.map((item) => [item.id, item])));

/** The stencil groups this package ships, by id, in menu order. */
export const STENCIL_GROUPS: Readonly<Record<string, StencilGroup>> = byId([FLOWCHART_GROUP, CONTAINERS_GROUP, UML_GROUP, ERD_GROUP]);

/** The flowchart: its symbols and containers, connectors as the theme draws them, no auto layout. */
export const FLOWCHART_TYPE: DiagramType = {
  id: 'flowchart',
  label: 'Flowchart',
  icon: icon('shape:diamond'),
  groups: [FLOWCHART_GROUP.id, CONTAINERS_GROUP.id],
};

/** A UML class diagram: classes and their kin, connectors routed orthogonally to an open arrowhead. */
export const UML_CLASS_TYPE: DiagramType = {
  id: 'umlClass',
  label: 'UML class',
  icon: icon('umlClass'),
  groups: [UML_GROUP.id, CONTAINERS_GROUP.id],
  edge: { router: 'orthogonal', markerEnd: 'arrow-open' },
};

/** An entity-relationship diagram: connectors routed orthogonally, one at the start and many at the end. */
export const ERD_TYPE: DiagramType = {
  id: 'erd',
  label: 'Entity relationship',
  icon: icon('erdEntity'),
  groups: [ERD_GROUP.id],
  edge: { router: 'orthogonal', markerStart: 'crow-one', markerEnd: 'crow-many' },
};

/** The diagram types this package ships, by id, in menu order. */
export const DIAGRAM_TYPES: Readonly<Record<string, DiagramType>> = byId([FLOWCHART_TYPE, UML_CLASS_TYPE, ERD_TYPE]);

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
