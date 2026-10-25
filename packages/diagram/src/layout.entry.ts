/**
 * `@weasel-js/diagram/layout` — the half of this package that is arithmetic.
 *
 * None of it touches a scene, a canvas, or a component, so a server that
 * renders a diagram can import it without React. The barrel cannot serve that:
 * it reaches `live` (a React hook) and `connect` (an interaction).
 *
 * **A `Graph` is an interface, not a class.** `buildGraph` reads one out of a
 * scene and is therefore absent here; a caller with its own nodes and edges
 * implements `Graph` over whatever it already has.
 *
 * Also absent on purpose: the routers, which `edge` runs where this package
 * meets the scene registry, and anything that reads or writes a node's trait.
 * The obstacle-avoiding router's search is here; its scene wiring is not.
 *
 * @packageDocumentation
 */

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
export {
  bodyOutline,
  canvasMeasure,
  layoutBody,
  layoutRowPorts,
  measureBody,
  sizeToBody,
} from './body';
export { buildBody } from './buildBody';
export type { BodyNodeSpec, BuildBodyOptions, RowNodeData } from './buildBody';
export { PORT_LABEL_GAP, marginOf, portLabelBox } from './portLabels';
export type { PerimeterPortLabelBox } from './portLabels';
export { footprintNode } from './footprint';
export type { ForceBody, ForceOptions, ForceRelaxation } from './force';
export { force, forceRelaxation } from './force';
export type { EdgeLabelRoom, Graph, GraphEdge, GraphGroup, GraphNode } from './graph';
export { chain } from './chain';
export { AVOID_DEFAULTS, createAvoidRouter, routeHolds } from './avoid';
export type {
  AvoidEdge, AvoidEnd, AvoidInput, AvoidLabel, AvoidObstacle, AvoidOptions, AvoidPort, AvoidRouter, AvoidRoutes, AvoidUpdateOptions,
} from './avoid';
export { edgeHops } from './hops/crossings';
export { DEFAULT_HOP_SIZE, HOPS_DOC_KEY } from './hops/types';
export type { EdgeHop, HopsDocValue } from './hops/types';
export { placeLabels } from './labels/place';
export type { LabelPlacements, PlaceLabel, PlaceLabelsInput, PlaceLabelsOptions, PlaceRoute } from './labels/place';
export { labelCenter } from './labels/station';
export type { DiagramLabel, LabelSpot } from './labelTrait';
export { backEdges, layered, layeredPlan, ranksByLength, ranksOf, type LayeredPlan } from './layered';
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
  anchorOffset,
  axesFor,
  DEFAULT_NODE_GAP,
  DEFAULT_RANK_GAP,
  extent,
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
export { outlinePolyline, portsOnOutline, rayHit } from './onOutline';
export type { Bounds, BuiltinOutline, Outline, OutlineDef } from './outline';
export { boxForContent, contentBox, outlineDetail, outlineFromD, outlinePath, registerOutline } from './outline';
export type { PortsOptions } from './ports';
export { COMPASS, DEFAULT_PORTS, portOf, portSitesOf, portsOf } from './ports';
export { forestOf, subtreeBlocks, tree } from './tree';
export { radial } from './radial';
export type { DiagramNode, Port, PortAnchor, PortSite, PortSpec } from './types';
