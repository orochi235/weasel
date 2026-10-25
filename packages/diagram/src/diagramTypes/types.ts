import type { MarkerRef } from '@weasel-js/core';
import type { IconRef } from '@weasel-js/icons';
import type { ContainerStencil } from '../containers/containerStencils';
import type { SET_ROUTER_ACTION_IDS } from '../routerCommands';
import type { DiagramStencil } from '../stencil';

/** A shipped connector router, by key. */
export type RouterName = keyof typeof SET_ROUTER_ACTION_IDS;

/** A named list of stencils: the flowchart symbols, the containers. */
export interface StencilGroup {
  id: string;
  label: string;
  stencils: readonly (DiagramStencil | ContainerStencil)[];
}

/** What a new connector is drawn with. An unset field falls to the theme. */
export interface DiagramTypeEdge {
  router?: RouterName;
  markerStart?: MarkerRef | null;
  markerEnd?: MarkerRef | null;
}

/** A kind of diagram: the stencil groups a new one opens with, how its connectors start out, and the
 *  layout Auto layout runs. */
export interface DiagramType {
  id: string;
  label: string;
  icon?: IconRef;
  /** Group ids, in Shapes-panel order, that a new chart of this type opens with. */
  groups: readonly string[];
  edge?: DiagramTypeEdge;
  /** A key of `LAYOUTS`. Unset: no auto layout. */
  layout?: string;
}

/** What {@link DIAGRAM_TYPE_DOC_KEY} holds: the diagram's type, and the groups its Shapes panel shows. */
export interface DiagramTypeDoc {
  type: string;
  groups: readonly string[];
}

/** The document value a diagram's type and shown stencil groups are saved under. */
export const DIAGRAM_TYPE_DOC_KEY = 'diagram:type';
