/**
 * The plain data `diagramScene` reads, and the options and styles it takes.
 */
import type { AddNodeSpec, MarkerRef, RectPose, Stroke } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import type { BodySpec, MeasureRowText, Row } from './body';
import type { DiagramEdge } from './edgeTrait';
import type { DiagramAnchor } from './group';
import type { DiagramLabel } from './labelTrait';
import type { LayoutFn, LayoutOptions, LayoutPorts } from './layout';
import type { DataMark, DiagramMark } from './marks';
import type { Outline } from './outline';
import type { DiagramTextStyle } from './rowStyle';
import type { DiagramTheme } from './theme/types';
import type { DiagramNode, PortSpec } from './types';

/** One node of a {@link DiagramData}: its rows of text, and optionally its outline, ports, size, and starting place. */
export interface DataNode {
  id: string;
  /** Shorthand for one `label` row per line. Ignored when `rows` is given. */
  lines?: readonly string[];
  rows?: readonly Row[];
  /** Default `DiagramSceneOptions.outline`, which defaults to `'rect'`. */
  outline?: Outline;
  /** Perimeter ports, replacing the four compass midpoints. */
  ports?: readonly PortSpec[];
  /** Labels for the perimeter ports by id, drawn outside the box beside each. */
  portLabels?: Readonly<Record<string, string>>;
  /** Layout leaves this node at `at`. */
  pinned?: boolean;
  /** Where the node starts, before layout. Unset, nodes start on the
   *  diagonal in source order, which is what within-rank order is seeded
   *  from. */
  at?: Vec2;
  /** The smallest the box may be. Its content grows it past this. */
  width?: number;
  height?: number;
  /** Default `DiagramSceneOptions.padding`. */
  padding?: number;
  /** Default `DiagramSceneOptions.gap`. */
  gap?: number;
  /** Default `DiagramSceneOptions.verticalAlign`. */
  verticalAlign?: BodySpec['verticalAlign'];
  /** Drawn over the box besides its rows: shapes in a unit square stretched
   *  over it, and text pinned to a point on it. */
  marks?: readonly DataMark[];
  /** The theme role it is drawn in, under `DiagramSceneOptions.theme`. Kept on its trait. */
  style?: string;
}

/** One edge of a {@link DiagramData}, between two nodes or groups by id. */
export interface DataEdge {
  /** The scene node id this edge gets, for an editor that must find it again
   *  after its ends, ports or label change. Unset, {@link edgeIdOf} derives
   *  one from those. */
  id?: string;
  /** A node's id, or a group's: an edge naming a group meets its box. */
  from: string;
  to: string;
  /** The port to leave from or arrive at. Unset, the end facing the other
   *  node most directly. */
  fromPort?: string;
  toPort?: string;
  label?: string;
  /** Where along the edge the label sits. Unset or at `'mid'`, under
   *  `layered` the label sits in the room layout leaves it beside its wire,
   *  at this placement's offset, else `DiagramSceneOptions.labelPlacement`'s;
   *  otherwise at the placement. */
  labelPlacement?: DiagramLabel;
  /** Default `DiagramSceneOptions.router`. */
  router?: DiagramRouter;
  /** World points the route passes through. Layout does not move them. */
  waypoints?: readonly Vec2[];
  /** A route a layout run wrote, as `DiagramView`'s `onMove` reports it: drawn
   *  until layout runs again, which may replace it. `waypoints` wins. */
  routed?: readonly Vec2[];
  /** Ports a layout run named, as `onMove` reports them: used like `routed`,
   *  and not part of the edge's id. `fromPort` and `toPort` win. */
  routedPorts?: LayoutPorts;
}

/** A box drawn around some nodes, which layout keeps together. */
export interface DataGroup {
  /** Shares one namespace with node ids. */
  id: string;
  /** Node ids, and the ids of groups nested in this one. A node or group a
   *  later group also names stays in this one; an id that is neither is
   *  ignored, and so is one that would put a group inside itself. */
  members: readonly string[];
  /** Drawn inside the box, above its members. */
  label?: string;
  /** Between the box and its members, and around the label. Default
   *  `DiagramSceneOptions.groupPadding`. */
  padding?: number;
  /** The axis its members can be dragged along to change their order, in a
   *  `DiagramView` given `onReorder`. A member that is a group carries
   *  everything inside it. */
  reorder?: 'x' | 'y';
}

/** A diagram as plain data, the input to `diagramScene`. */
export interface DiagramData {
  nodes: readonly DataNode[];
  edges: readonly DataEdge[];
  /** A group may be a member of another. `layered`, `tree`, and `force` keep
   *  each group's members together; `chain` and `'none'` ignore groups but
   *  still draw them. */
  groups?: readonly DataGroup[];
  /** Containers and pools: regions drawn as scene containers that hold their
   *  members, which a `DiagramView` drags shapes into and out of. */
  containers?: readonly DataContainer[];
}

/**
 * A container or a pool, drawn as a region that holds its members. Its id
 * shares one namespace with node, group, and lane ids.
 *
 * With a `box` it is laid out as one node of that size, and its members ride
 * along with it: a member with no `at` is seeded inside its body, in rows.
 * With none, a container is laid out as a group and its box fits its members.
 * A pool always has a box, {@link DEFAULT_POOL_ACROSS} across and
 * {@link DEFAULT_LANE_SIZE} along per lane when none is given. An edge with
 * an end inside a boxed region ranks against the outermost one holding it.
 */
export interface DataContainer {
  id: string;
  role: 'container' | 'pool';
  /** Its title, drawn in its header. */
  label?: string;
  /** A container's direct members: node ids and container ids. A member
   *  already claimed by an earlier container, a pool, an unknown id, and one
   *  that would put a container inside itself are ignored. */
  members?: readonly string[];
  /** A pool's lanes, in the order they stack. */
  lanes?: readonly DataLane[];
  /** The axis a pool stacks its lanes along: `'y'` for rows. Default `'y'`. */
  axis?: 'x' | 'y';
  /** Where it stands and how big it is, in world units. A pool's size along
   *  its stack is shared by the lanes that give no `size`. */
  box?: { x: number; y: number; width: number; height: number };
  /** Layout leaves its box where it is. */
  pinned?: boolean;
  /** The theme role it is drawn in. Unset, a container takes the theme's
   *  `container` style, a pool its `lane.header`. */
  style?: string;
}

/** One lane of a pool. Its id shares the node id namespace. */
export interface DataLane {
  id: string;
  label?: string;
  /** Its depth along the pool's stack, in world units. */
  size?: number;
  /** Node ids and container ids, claimed as a container's are. */
  members?: readonly string[];
}

/** A pool's size across its stack when it gives no box. */
export const DEFAULT_POOL_ACROSS = 600;
/** A lane's size along its pool's stack when neither it nor the pool's box gives one. */
export const DEFAULT_LANE_SIZE = 120;

/** The colors and outline a node is drawn with. */
export interface NodeStyle {
  fill: string;
  stroke: string;
  text: string;
  strokeWidth?: number;
  dash?: number[];
}

/** What a node is drawn with when nothing says otherwise. */
export const NODE: NodeStyle = { fill: '#16222c', stroke: '#7ba7c7', text: '#dbe7f2' };

/** The stroke, markers, and label color an edge is drawn with. */
export interface EdgeStyle {
  stroke: string;
  width?: number;
  dash?: number[];
  /** `null` for none. Default none. */
  markerStart?: MarkerRef | null;
  /** `null` for none. Default `'arrow'`. */
  markerEnd?: MarkerRef | null;
  /** Default `stroke`. */
  label?: string;
}

/** How an edge is drawn between its ends. */
export type DiagramRouter = 'straight' | 'bezier' | 'orthogonal' | 'avoid';
/** The `data` of a scene node `diagramScene` makes: its diagram role, and what it paints. */
export interface DiagramSceneData {
  diagram?: DiagramNode | DiagramEdge | { label: DiagramLabel } | { anchor: DiagramAnchor } | { mark: DiagramMark };
  fill?: { paint: { color: string; opacity?: number } };
  stroke?: Stroke;
  text?: string;
  style?: DiagramTextStyle;
  verticalAlign?: 'top' | 'center' | 'bottom';
  /** What a slot is filled with: an image the kit's image painter draws. */
  image?: { src: string; opacity?: number };
}

/** A scene node spec, as `diagramScene` returns them. */
export type DiagramSpec = AddNodeSpec<DiagramSceneData, 'main', RectPose>;

/** How `diagramScene` lays out, routes, and styles a {@link DiagramData}. */
export interface DiagramSceneOptions {
  /** A layout by name, or any `LayoutFn`. Default `'layered'`. `'none'`
   *  leaves every node at its `at`. */
  layout?: 'layered' | 'tree' | 'force' | 'chain' | 'none' | LayoutFn;
  /** Merged over `{ order: 'barycenter' }`. */
  layoutOptions?: LayoutOptions;
  /** Default `'bezier'`. */
  router?: DiagramRouter;
  /** The text style rows fall back on. Default 12px sans-serif. */
  font?: { fontFamily: string; fontSize: number };
  /** Measures one run of text. Default an estimate from character count, so
   *  layout needs no canvas; pass `canvasMeasure(ctx)` for real widths. */
  measure?: MeasureRowText;
  /** Default `'rect'`. */
  outline?: Outline;
  /** Between a box's outline and its rows. Default 8. */
  padding?: number;
  /** Between adjacent rows. Default 4. */
  gap?: number;
  /** Where a box's rows sit when it is taller than they need. Default `'center'`. */
  verticalAlign?: BodySpec['verticalAlign'];
  /** The narrowest a box may be. Default 64. */
  minWidth?: number;
  /** Where edge labels sit. Default `{ at: 'mid', offset: 9 }`. */
  labelPlacement?: DiagramLabel;
  nodeStyle?: (node: DataNode) => NodeStyle;
  /** Default 12. */
  groupPadding?: number;
  /** A group's box and label. `text` colors the label. */
  groupStyle?: (group: DataGroup) => NodeStyle;
  edgeStyle?: (edge: DataEdge) => EdgeStyle;
  /** Styles nodes by their `style` role, and edges, groups and text by the theme, where the
   *  functions above leave them; and its face is the default `font`. */
  theme?: DiagramTheme;
}
