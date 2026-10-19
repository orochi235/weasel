/**
 * `@weasel-js/diagram` — node-link diagramming over weasel's scene graph.
 *
 * A diagram is not a second document kept in sync with the scene: participants
 * and edges are scene nodes, which is what buys selection, hit-testing, hover,
 * styling, z-order, SVG export, undo and copy/paste without implementing any
 * of them.
 *
 * @packageDocumentation
 */
export {
  bodyOutline,
  bodyTrait,
  buildBody,
  canvasMeasure,
  layoutBody,
  layoutRowPorts,
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
  RowPortBox,
  RowTextStyle,
} from './body';
export { PORT_LABEL_GAP, marginOf, portLabelBox, portLabelsOf } from './portLabels';
export type { PerimeterPortLabelBox, PortLabelPlacement } from './portLabels';
export { footprintNode } from './footprint';
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
export { bodyAt, isBodyEnd } from './connectTargets';
export type { BodyEnd, BodyHit, ConnectEnd, ConnectView } from './connectTargets';
export { CONNECTOR_ACTION_ID, CONNECTOR_TOOL_ID, connectorTool, useConnectorTool } from './connectorTool';
export { createDiagramContribution, diagramPorts } from './contribution';
export type { DiagramContributionOptions } from './contribution';
export {
  EDGE_END_AFFORDANCE_KIND,
  EDGE_END_LAYER_ID,
  createEdgeEndAffordance,
  edgeEndLayer,
  edgeEndScratchOf,
} from './edgeEndLayer';
export type { EdgeEndAffordanceOptions, EdgeEndScratch } from './edgeEndLayer';
export {
  GRAB_EDGE_END_ACTION_ID,
  RECONNECT_ACTION_ID,
  commitReconnectToScene,
  createReconnectAction,
  diagramEdgeEnds,
  reconnectBinding,
} from './reconnect';
export type { EndChange, ReconnectOptions } from './reconnect';
export {
  DIAGRAM_EDGE,
  EDGE_DERIVE_PATH,
  ROUTERS,
  bezier,
  edgeDerivePath,
  orthogonal,
  resolveEnd,
  straight,
  withDiagramRegistry,
} from './edge';
export type { EdgeRouteOptions, RouteRequest, Router } from './edge';
export { diagramEdgeOf, layoutOwnsPort, layoutOwnsRoute } from './edgeTrait';
export type { DiagramEdge, EdgeEnd } from './edgeTrait';
export { selfLoop } from './selfLoop';
export type { SelfLoop } from './selfLoop';
export { buildGraph } from './graph';
export type {
  BuildGraphOptions,
  EdgeLabelRoom,
  Graph,
  GraphEdge,
  GraphGroup,
  GraphNode,
  GraphNodeLike,
  GraphSource,
} from './graph';
export { EDIT_EDGE_LABEL_ACTION_ID, edgeLabelSpec, editEdgeLabelAction, editEdgeLabelBinding } from './edgeLabel';
export type { EdgeLabelOptions, EditEdgeLabelOptions } from './edgeLabel';
export { DIAGRAM_LABEL, LABEL_DERIVE_POSE, labelDerivePose } from './label';
export type { LabelPoseOptions } from './label';
export { diagramLabelOf } from './labelTrait';
export type { DiagramLabel } from './labelTrait';
export { DEFAULT_GROUP_INSET, expandGroupEdges, insetOf, packClusters, rankGaps } from './cluster';
export type { GroupInset } from './cluster';
export {
  ANCHOR_DERIVE_POSE,
  DIAGRAM_ANCHOR,
  DIAGRAM_GROUP,
  GROUP_DERIVE_POSE,
  anchorDerivePose,
  boxAround,
  diagramAnchorOf,
  diagramGroupOf,
  groupDerivePose,
} from './group';
export type { DiagramAnchor, DiagramDerivePose, GroupPoseOptions } from './group';
export { diagramScene, edgeIdOf } from './fromData';
export type {
  DataEdge,
  DataGroup,
  DataNode,
  DiagramData,
  DiagramRouter,
  DiagramSceneData,
  DiagramSceneOptions,
  DiagramSpec,
  DiagramTextStyle,
  EdgeStyle,
  NodeStyle,
} from './fromData';
export { diagramMarkOf, markShape, registerMarkShape } from './marks';
export type { DataMark, DiagramMark } from './marks';
export { force, forceRelaxation } from './force';
export type { ForceBody, ForceOptions, ForceRelaxation } from './force';
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
export { chain } from './chain';
export { backEdges, layered, layeredPlan, ranksByLength, ranksOf, type LayeredPlan } from './layered';
export { layeredRoutes } from './route';
export type { LayeredRoute, LayeredRouteInput, RouteEdge } from './route';
export {
  DEFAULT_NODE_GAP,
  DEFAULT_RANK_GAP,
  anchorOffset,
  axesFor,
  graphOrder,
  packAcross,
  pinnedSet,
  planOf,
  plannerPlan,
  seededOrder,
  settle,
  translated,
  untilSettled,
} from './layout';
export type {
  LayoutAxes,
  LayoutDirection,
  LayoutFn,
  LayoutOptions,
  LayoutPlan,
  LayoutPlanner,
  LayoutPorts,
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
export { routeWrites, routesOf, type LayoutRoutes, type RoutedScene } from './routeWrites';
export { forestOf, tree, type Forest } from './tree';
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
export { COMPASS, DEFAULT_PORTS, portOf, portSitesOf, portsOf } from './ports';
export type { PortsOptions } from './ports';
export {
  DIAGRAM_TRAIT_KEY,
  createDiagramNodes,
  dataKeyReader,
  diagramNodeOf,
  isPinned,
} from './trait';
export type { DiagramNodeEntry, DiagramNodeLike, DiagramNodeReader } from './trait';
export type { DiagramGroup, DiagramNode, Port, PortAnchor, PortSite, PortSpec } from './types';
export { DiagramView } from './DiagramView';
export type {
  DeleteReport, DiagramLayout, DiagramViewApi, DiagramViewProps, EdgeRoute, NodeMove, ReconnectChange,
} from './DiagramView';
export { diagramLayoutOf } from './sceneSync';
export { useMirroredSelection } from './mirrorSelection';
