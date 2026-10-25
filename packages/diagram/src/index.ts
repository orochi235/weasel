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
  canvasMeasure,
  layoutBody,
  layoutRowPorts,
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
  RowPortBox,
  RowTextStyle,
} from './body';
export { buildBody } from './buildBody';
export type { BodyNodeSpec, BuildBodyOptions, RowNodeData } from './buildBody';
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
export type { CanConnect, ConnectActionOptions, MovingEnd, PendingEdge } from './connect';
export { bodyAt, isBodyEnd } from './connectTargets';
export type { BodyEnd, BodyHit, ConnectEnd, ConnectView } from './connectTargets';
export { CONNECTOR_ACTION_ID, CONNECTOR_TOOL_ID, connectorTool, useConnectorTool } from './connectorTool';
export { FLOWCHART_STENCILS, stencilBuild, stencilIdOf, stencilKind } from './stencil';
export type { DiagramStencil } from './stencil';
export { stencilTool, useStencilInsert, useStencilTool } from './stencilTool';
export type { StencilInsertOptions } from './stencilTool';
export * from './containers';
export {
  GRAB_LABEL_ACTION_ID, GRAB_WAYPOINT_ACTION_ID, SELECT_LABEL_EDGE_ACTION_ID,
  createDiagramContribution, diagramLabelDrag, diagramPorts, diagramWaypoints,
} from './contribution';
export type { DiagramContributionOptions } from './contribution';
export {
  WAYPOINT_AFFORDANCE_KIND,
  WAYPOINT_HIT_PX,
  WAYPOINT_LAYER_ID,
  createWaypointAffordance,
  routeStateOf,
  waypointLayer,
  waypointScratchOf,
} from './waypointLayer';
export type { EdgeRouteState, WaypointAffordanceOptions, WaypointScratch } from './waypointLayer';
export { ROUTE_EDIT_ACTION_ID, commitRouteToScene, createRouteEditAction, routedData } from './waypointAction';
export {
  REMOVE_WAYPOINT_ACTION_ID, RESET_ROUTE_ACTION_ID, createRemoveWaypointAction, createResetRouteAction,
} from './routeCommands';
export type { RouteEdit, RouteEditOptions } from './waypointAction';
export {
  ROUTER_LABELS, SET_ROUTER_ACTION_IDS, commitRouterToScene, createSetRouterAction, routerActions, withRouter,
} from './routerCommands';
export type { RouterEdit, SetRouterOptions } from './routerCommands';
export {
  dragSegment, dragVertex, insertWaypoint, pinSegment, removeSegment, removeWaypoint, routeHandles, segmentAxis,
  simplifyStops, unpinSegment,
} from './waypoints';
export type { RouteHandle } from './waypoints';
export { waypointFollower } from './waypointFollower';
export { AVOID_DEFAULTS, createAvoidRouter, routeHolds } from './avoid';
export type {
  AvoidEdge, AvoidEnd, AvoidInput, AvoidLabel, AvoidObstacle, AvoidOptions, AvoidPort, AvoidRouter, AvoidRoutes, AvoidUpdateOptions,
} from './avoid';
export { avoidSceneInput, headerIdOf } from './avoid/sceneInput';
export type { AvoidSceneOptions } from './avoid/sceneInput';
export { installAvoidRouting, routeDataOps } from './avoid/install';
export { DIAGRAM_PASS_ORDER } from './passOrder';
export type { AvoidRouting, AvoidRoutingOptions } from './avoid/install';
export { useAvoidRouting } from './avoid/useAvoidRouting';
export { createSpecRouter } from './avoid/specRoutes';
export { DEFAULT_HOP_SIZE, HOPS_DOC_KEY } from './hops/types';
export type { EdgeHop, HopsDocValue } from './hops/types';
export { edgeHops } from './hops/crossings';
export { withHops } from './hops/draw';
export { installHops } from './hops/install';
export type { Hops, HopsOptions } from './hops/install';
export { hopFollower } from './hops/follower';
export { useHops } from './hops/useHops';
export { SET_HOPS_ACTION_ID, createSetHopsAction } from './hops/hopsAction';
export type { SetHopsOptions } from './hops/hopsAction';
export { createSpecHops } from './hops/specHops';
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
export { REORDER_ACTION_ID, createReorderAction, reorderBinding, reorderContribution, sequenceSlots } from './reorder';
export type { ReorderGap, ReorderItem, ReorderMove, ReorderOptions, ReorderSlots } from './reorder';
export {
  STEP_REORDER_ACTION_ID, createStepReorderAction, groupReorderContribution, groupReorderSlots,
} from './groupReorder';
export {
  DIAGRAM_EDGE,
  EDGE_DERIVE_PATH,
  OFF_PAGE_STUB,
  ROUTERS,
  avoid,
  bezier,
  edgeDerivePath,
  edgeRouter,
  orthogonal,
  resolveEnd,
  straight,
  withDiagramRegistry,
} from './edge';
export type { EdgeRouteOptions, ResolvedRoute, RouteRequest, Router } from './edge';
export { diagramEdgeOf, layoutOwnsPort, layoutOwnsRoute, layoutWritesRoute } from './edgeTrait';
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
export { EDIT_EDGE_LABEL_ACTION_ID, dropEmptyEdgeLabel, edgeLabelSpec, editEdgeLabelAction, editEdgeLabelBinding, labelSize } from './edgeLabel';
export type { EdgeLabelOptions, EditEdgeLabelOptions } from './edgeLabel';
export {
  LABEL_DRAG_AFFORDANCE_KIND, LABEL_DRAG_LAYER_ID, draggableLabels, labelDragLayer, labelScratchOf, labelUnder,
} from './labelDragLayer';
export type { DraggableLabel, LabelScratch } from './labelDragLayer';
export { MOVE_LABEL_ACTION_ID, commitLabelToScene, createLabelDragAction, movedLabelData } from './labelDragAction';
export type { LabelDragOptions, LabelEdit } from './labelDragAction';
export { RESET_LABEL_ACTION_ID, createResetLabelAction } from './labelCommands';
export { DIAGRAM_LABEL, LABEL_DERIVE_POSE, labelCenter, labelDerivePose } from './label';
export type { LabelPoseOptions } from './label';
export { LABEL_PLACEMENT, diagramLabelOf } from './labelTrait';
export type { DiagramLabel, LabelSpot } from './labelTrait';
export { placeLabels } from './labels/place';
export type { LabelPlacements, PlaceLabel, PlaceLabelsInput, PlaceLabelsOptions, PlaceRoute } from './labels/place';
export { installLabelPlacement } from './labels/install';
export type { LabelPlacement, LabelPlacementOptions } from './labels/install';
export { useLabelPlacement } from './labels/useLabelPlacement';
export { createSpecLabelPlacer } from './labels/specLabels';
export { dataOffPage, diagramPages } from './dataPages';
export { nextOffPageRef, offPageSplits } from './offPage/split';
export type { OffPageEdgeInput, OffPageSplitInput } from './offPage/split';
export {
  DIAGRAM_OFF_PAGE_TAG, OFF_PAGE_TAG_DERIVE_POSE, OFF_PAGE_TAG_PADDING, offPageTagData, offPageTagDerivePose, offPageTagLook,
  offPageFarText, offPageTagSize, offPageTagSpec, offPageTagSpecs, offPageTagText,
} from './offPage/tag';
export type { OffPageTagLook } from './offPage/tag';
export { offPageTagId, offPageTagOf } from './offPage/trait';
export type { OffPageSplit, OffPageTag } from './offPage/trait';
export { documentBoundsOf } from './offPage/endBox';
export { installOffPageMarkers, offPageOps } from './offPage/install';
export type { OffPageMarkerOptions } from './offPage/install';
export { useOffPageMarkers } from './offPage/useOffPageMarkers';
export {
  FOLLOW_OFF_PAGE_ACTION_ID, createFollowOffPageAction, diagramOffPage, followOffPageBinding, offPageTargetOf,
} from './offPage/follow';
export type { FollowOffPageOptions, OffPageTarget } from './offPage/follow';
export { subpathOf } from './subpaths';
export { diagramResizable } from './resizable';
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
export { DEFAULT_GROUP_STYLE, DEFAULT_NODE_STYLE, diagramScene, edgeIdOf } from './fromData';
export { DEFAULT_LANE_SIZE, DEFAULT_POOL_ACROSS, EDGE_STROKE_WIDTH, LANE_STROKE_WIDTH, NODE_STROKE_WIDTH } from './dataTypes';
export { DEFAULT_EDGE_STYLE, dataEdgeStyle, dataNodeStyle, dataRegionStyle, type StyledRegion } from './dataStyles';
export type { DataContainer, DataLane } from './dataTypes';
export { rowTextStyle } from './rowStyle';
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
export { forestOf, subtreeBlocks, tree, type Forest } from './tree';
export { radial } from './radial';
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
export { boxForContent, contentBox, outlineDetail, outlineFromD, outlinePath, registerOutline } from './outline';
export { diagramShape, registerDiagramShape } from './shape';
export type { DiagramShapeOptions } from './shape';
export type { Bounds, BuiltinOutline, Outline, OutlineDef } from './outline';
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
export { isBodyOrRegion, isDiagramBody } from './bodyNode';
export type { DiagramGroup, DiagramNode, Port, PortAnchor, PortSite, PortSpec } from './types';
export { DiagramView } from './DiagramView';
export type {
  ContainerEdit, DeleteReport, DiagramLayout, DiagramOverlay, DiagramViewApi, DiagramViewProps, EdgeRoute, LabelMove, NodeMove, NodeResize,
  ReconnectChange, ReorderChange, RouteChange,
} from './DiagramView';
export { diagramLayoutOf } from './sceneSync';
export { useMirroredSelection } from './mirrorSelection';
export { DIAGRAM_ROLES, DIAGRAM_THEME_KEY } from './theme/types';
export type { DiagramFont, DiagramRole, DiagramTheme, FontField, StyleField } from './theme/types';
export { DIAGRAM_THEMES } from './theme/themes';
export { diagramThemeFromTokens } from './theme/fromTokens';
export {
  diagramThemeFrom, diagramThemeOf, roleEdgeStyle, roleStyle, themeDocValue, themeEdgeStroke, themeFont, themeLabelFont,
  themeLabelStyle,
} from './theme/resolve';
export { themeWrites } from './theme/themeWrites';
export type { ThemedNode, ThemedScene } from './theme/themeWrites';
export { rendererMeasure } from './rendererMeasure';
export { relayoutBodies } from './bodyRelayout';
export type { RelayoutScene } from './bodyRelayout';
export { applyDiagramTheme, diagramStyleOf, setDiagramColor, setDiagramFontSize, setDiagramStyle } from './theme/applyTheme';
export type { ApplyDiagramThemeOptions, DiagramStyleEditOptions, DiagramStyleState } from './theme/applyTheme';
export {
  addThemeRole, editableTheme, forkTheme, isShippedTheme, removeThemeRole, renameThemeRole, setThemeValue, themeRoles,
  themeValue,
} from './theme/themeEdit';
export type { ThemePath } from './theme/themeEdit';
export { DIAGRAM_THEME_EXTENSION, parseDiagramTheme, themeToJson } from './theme/themeFile';
export * from './diagramTypes';
export { FLOWCHART_GROUP } from './stencils/flowchart';
export { CONTAINERS_GROUP } from './stencils/containers';
export { layoutDiagram } from './layoutAction';
export type { LayoutDiagramOptions } from './layoutAction';
