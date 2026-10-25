export { DIAGRAM_TYPES, FLOWCHART_TYPE, STENCIL_GROUPS, groupStencilIds, groupStencils, isContainerStencil } from './catalog';
export {
  addStencilGroup, diagramTypeDocOf, diagramTypeDocValue, diagramTypeOf, removeStencilGroup, setDiagramType,
} from './doc';
export type { DiagramTypeScene, DiagramTypeWriteOptions } from './doc';
export { diagramTypeEdgeStroke } from './edge';
export { DIAGRAM_TYPE_DOC_KEY } from './types';
export type { DiagramType, DiagramTypeDoc, DiagramTypeEdge, RouterName, StencilGroup } from './types';
