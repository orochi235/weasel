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
 * Also absent on purpose: the routers, which live in `edge` where this package
 * meets the scene registry, and anything that reads or writes a node's trait.
 *
 * @packageDocumentation
 */

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
export {
  bodyOutline,
  buildBody,
  canvasMeasure,
  layoutBody,
  layoutRowPorts,
  measureBody,
  sizeToBody,
} from './body';
export { PORT_LABEL_GAP, marginOf, portLabelBox } from './portLabels';
export type { PerimeterPortLabelBox } from './portLabels';
export { footprintNode } from './footprint';
export type { ForceBody, ForceOptions, ForceRelaxation } from './force';
export { force, forceRelaxation } from './force';
export type { EdgeLabelRoom, Graph, GraphEdge, GraphGroup, GraphNode } from './graph';
export { chain } from './chain';
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
export type { Bounds, Outline } from './outline';
export { boxForContent, contentBox, outlinePath } from './outline';
export type { PortsOptions } from './ports';
export { COMPASS, DEFAULT_PORTS, portOf, portSitesOf, portsOf } from './ports';
export { forestOf, tree } from './tree';
export type { DiagramNode, Port, PortAnchor, PortSite, PortSpec } from './types';
