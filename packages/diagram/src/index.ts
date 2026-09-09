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
  buildBody,
  canvasMeasure,
  layoutBody,
  measureBody,
  sizeToBody,
} from './body';
export type {
  BodyFloor,
  BodyNodeSpec,
  BodySpec,
  BuildBodyOptions,
  MeasureRowText,
  Row,
  RowBox,
  RowNodeData,
  RowPort,
  RowTextStyle,
} from './body';
export {
  CONNECT_ACTION_ID,
  DEFAULT_EDGE_STROKE,
  GRAB_PORT_ACTION_ID,
  commitEdgeToScene,
  connectBinding,
  createConnectAction,
  defaultCanConnect,
  grabPortAction,
  grabPortBindings,
} from './connect';
export type { CanConnect, ConnectActionOptions, PendingEdge } from './connect';
export { createDiagramContribution, diagramPorts } from './contribution';
export type { DiagramContributionOptions } from './contribution';
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
export { buildGraph } from './graph';
export type {
  BuildGraphOptions,
  Graph,
  GraphEdge,
  GraphNode,
  GraphNodeLike,
  GraphSource,
} from './graph';
export { DIAGRAM_LABEL, LABEL_DERIVE_POSE, diagramLabelOf, labelDerivePose } from './label';
export type { DiagramLabel, LabelPoseOptions } from './label';
export { force, forceRelaxation } from './force';
export type { ForceOptions, ForceRelaxation } from './force';
export { EASED_LAYOUTS, easedProducer, forceProducer, useLiveLayout } from './live';
export type {
  EasedProducerOptions,
  ForceProducerOptions,
  LiveLayout,
  LiveLayoutCtx,
  LiveLayoutFrame,
  LiveLayoutProducer,
  UseLiveLayoutOptions,
} from './live';
export { backEdges, layered, ranksOf } from './layered';
export {
  DEFAULT_NODE_GAP,
  DEFAULT_RANK_GAP,
  axesFor,
  graphOrder,
  packAcross,
  pinnedSet,
  seededOrder,
  settle,
  translated,
} from './layout';
export type {
  LayoutAxes,
  LayoutDirection,
  LayoutFn,
  LayoutOptions,
  LayoutResult,
  Slot,
} from './layout';
export {
  LAYOUTS,
  LAYOUT_ACTION_ID,
  applyLayout,
  layoutPoses,
  createLayoutAction,
} from './layoutAction';
export type { ApplyLayoutOptions, LayoutActionOptions } from './layoutAction';
export { forestOf, tree } from './tree';
export { outlinePolyline, portsOnOutline, rayHit } from './onOutline';
export {
  PORT_AFFORDANCE_KIND,
  PORT_LAYER_ID,
  createPortAffordance,
  portScratchOf,
} from './portAffordance';
export type {
  ParticipantPose,
  ParticipantSource,
  PortAffordanceOptions,
  PortScratch,
} from './portAffordance';
export { portLayer, sceneParticipants } from './portLayer';
export type { ParticipantScene } from './portLayer';
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
