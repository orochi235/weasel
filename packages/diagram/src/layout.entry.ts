/**
 * `@weasel-js/diagram/layout` — the half of this package that is arithmetic.
 *
 * Measuring a box from its rows, ranking a graph, relaxing one under forces,
 * and finding the point on a box's perimeter where an edge should leave: none
 * of it touches a scene, a canvas or a component, and a server that renders a
 * diagram needs exactly this and must not need the rest. The barrel cannot
 * serve that — it reaches `live` (a React hook) and `connect` (an interaction),
 * so importing `@weasel-js/diagram` from Node pulls React in whether or not a
 * component is ever rendered.
 *
 * **A `Graph` is an interface, not a class.** `buildGraph` reads one out of a
 * scene and is therefore absent here, but nothing requires it: a caller with
 * its own nodes and edges implements `nodes`, `edges`, `node`, `outgoing` and
 * `incoming` over whatever it already has, and every layout below accepts it.
 *
 * Absent for a reason, not by oversight:
 *
 * - **The routers** (`bezier`, `orthogonal`, `straight`) live in `edge`, which
 *   is where this package meets the scene registry — and they are typed in
 *   `Vec2`, so a consumer routing in three dimensions cannot call them anyway.
 * - **Anything that reads or writes a node's trait** (`trait`, `connect`,
 *   `contribution`, `portAffordance`, `portLayer`, `shape`, `label`), which is
 *   the scene half by definition.
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
export type { ForceOptions, ForceRelaxation } from './force';
export { force, forceRelaxation } from './force';
export type { Graph, GraphEdge, GraphNode } from './graph';
export { backEdges, layered, ranksOf } from './layered';
export type {
  LayoutAxes,
  LayoutDirection,
  LayoutFn,
  LayoutOptions,
  LayoutResult,
  Slot,
} from './layout';
export {
  axesFor,
  DEFAULT_NODE_GAP,
  DEFAULT_RANK_GAP,
  extent,
  graphOrder,
  packAcross,
  pinnedSet,
  seededOrder,
  settle,
  translated,
} from './layout';
export { outlinePolyline, portsOnOutline, rayHit } from './onOutline';
export type { Bounds, Outline } from './outline';
export { boxForContent, contentBox, outlinePath } from './outline';
export type { PortsOptions } from './ports';
export { COMPASS, DEFAULT_PORTS, portOf, portsOf } from './ports';
export { forestOf, tree } from './tree';
export type { DiagramNode, Port, PortAnchor, PortSpec } from './types';
