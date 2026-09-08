/**
 * `@weasel-js/diagram` — node-link diagramming over weasel's scene graph.
 *
 * A diagram is not a second document kept in sync with the scene: participants
 * and edges are scene nodes, which is what buys selection, hit-testing, hover,
 * styling, z-order, SVG export, undo and copy/paste without implementing any
 * of them.
 */
export {
  bodyOutline,
  bodyTrait,
  canvasMeasure,
  layoutBody,
  measureBody,
  sizeToBody,
} from './body';
export type {
  BodyFloor,
  BodySpec,
  MeasureRowText,
  Row,
  RowBox,
  RowPort,
  RowTextStyle,
} from './body';
export {
  DIAGRAM_EDGE,
  EDGE_DERIVE_PATH,
  ROUTERS,
  bezier,
  diagramEdgeOf,
  edgeDerivePath,
  orthogonal,
  resolveEnd,
  straight,
  withDiagramRegistry,
} from './edge';
export type { DiagramEdge, EdgeEnd, EdgeRouteOptions, RouteRequest, Router } from './edge';
export { outlinePolyline, portsOnOutline, rayHit } from './onOutline';
export { boxForContent, contentBox, outlinePath } from './outline';
export { diagramShape, registerDiagramShape } from './shape';
export type { DiagramShapeOptions } from './shape';
export type { Bounds, Outline } from './outline';
export { COMPASS, DEFAULT_PORTS, portOf, portsOf } from './ports';
export type { PortsOptions } from './ports';
export {
  DIAGRAM_TRAIT_KEY,
  createDiagramNodes,
  dataKeyReader,
  diagramNodeOf,
  isPinned,
} from './trait';
export type { DiagramNodeEntry, DiagramNodeLike, DiagramNodeReader } from './trait';
export type { DiagramNode, Port, PortAnchor, PortSpec } from './types';
