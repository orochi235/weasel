/**
 * `diagramScene` — a laid-out diagram from plain `{ nodes, edges }`.
 *
 * Every box is a `buildBody` body, so a data node can say anything a body
 * can: outline, rows, padding, ports. Sizes are estimated from character
 * counts unless `measure` is given, so layout runs without a canvas and gives
 * the same answer in node and in a browser.
 */
import type { AddNodeSpec, MarkerRef, RectPose, Stroke } from '@weasel-js/core';
import { DEFAULT_GROUP_INSET, expandGroupEdges } from './cluster';
import { groupSpecs, resolveGroups } from './dataGroups';
import { bodyLayoutOf } from './bodyRelayout';
import { bodyTrait, buildBody, measureBody, sizeToBody, type BodySpec, type MeasureRowText, type Row, type RowTextStyle } from './body';
import { edgeIdOf } from './edgeId';
import { edgeSpecs, wireLabels } from './dataEdges';
import { DEFAULT_FONT, GLYPH, labelSize, labelStyleOf } from './edgeLabel';
import type { DiagramEdge } from './edgeTrait';
import { force } from './force';
import { grownBy } from './footprint';
import { graphOf, labelFollowsLayout, type EdgeLabelRoom, type GraphEdge, type GraphGroup, type GraphNode } from './graph';
import type { DiagramAnchor } from './group';
import { LABEL_PLACEMENT, type DiagramLabel } from './labelTrait';
import { chain } from './chain';
import { rowTextStyle, textFace, type DiagramTextStyle } from './rowStyle';
export type { DiagramTextStyle };
import { layered } from './layered';
import { planOf, type LayoutFn, type LayoutOptions, type LayoutPorts } from './layout';
import { markSpecs, type DataMark, type DiagramMark } from './marks';
import type { OffPageTag } from './offPage/trait';
import type { Outline } from './outline';
import { authoredOver } from './route';
import { roleEdgeStyle, roleStyle, themeFont, themeLabelFont } from './theme/resolve';
import type { DiagramTheme } from './theme/types';
import { tree } from './tree';
import type { DiagramNode, PortSpec } from './types';
import type { Vec2 } from '@weasel-js/core/math';

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
}

/** The colors and outline a node is drawn with. */
export interface NodeStyle {
  fill: string;
  stroke: string;
  text: string;
  strokeWidth?: number;
  dash?: number[];
}

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
  diagram?: DiagramNode | DiagramEdge | { label: DiagramLabel } | { anchor: DiagramAnchor } | { mark: DiagramMark } | { offPageTag: OffPageTag };
  fill?: { paint: { color: string; opacity?: number } };
  stroke?: Stroke;
  text?: string;
  style?: DiagramTextStyle;
  verticalAlign?: 'top' | 'center' | 'bottom';
  /** What a slot is filled with: an image the kit's image painter draws. */
  image?: { src: string; opacity?: number };
  /** A body's text row: its place among the body's rows (see `DiagramNode.body`). */
  bodyRow?: number;
  /** An off-page tag's box, behind its text, and the room between them. */
  background?: { paint: { color: string } };
  padding?: number;
}

/** The frame an empty slot with an id draws, in the unit square a mark is drawn in. */
export const SLOT_FRAME = 'M0 0H1V1H0Z';

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

/** What a node is drawn with when nothing says otherwise. */
export const NODE: NodeStyle = { fill: '#16222c', stroke: '#7ba7c7', text: '#dbe7f2' };
const EDGE: EdgeStyle = { stroke: '#7ba7c7' };
const GROUP: NodeStyle = { fill: 'rgba(123, 167, 199, 0.08)', stroke: '#7ba7c7', text: '#9fbdd6', strokeWidth: 1, dash: [4, 3] };
export { LABEL_PLACEMENT };
const LINE = 1.4;
const MIN_WIDTH = 64;
const LAYOUTS = { layered, tree, force, chain } as const;

export { edgeIdOf };

/** The room an edge's label asks layout for: none when the edge puts its
 *  label somewhere layout does not station it, or routes itself through
 *  waypoints of its own. */
function labelRoomOf(e: DataEdge, opts: DiagramSceneOptions, font: { fontFamily: string; fontSize: number },
  measure: MeasureRowText): EdgeLabelRoom | null {
  if (!e.label || e.waypoints !== undefined) return null;
  if (e.labelPlacement !== undefined && !labelFollowsLayout(e.labelPlacement.at)) return null;
  const style = labelStyleOf(font);
  const offset = (e.labelPlacement ?? opts.labelPlacement ?? LABEL_PLACEMENT).offset;
  return { ...labelSize(e.label, style, measure), ...(offset !== undefined ? { offset } : {}) };
}

/** A data edge as layout reads it: its ends, the ports it names, and the room
 *  its label asks for. */
function graphEdgeOf(e: DataEdge, room: EdgeLabelRoom | null): GraphEdge {
  return {
    id: edgeIdOf(e),
    from: e.from,
    to: e.to,
    ...(e.fromPort ? { fromPort: e.fromPort } : {}),
    ...(e.toPort ? { toPort: e.toPort } : {}),
    ...(room !== null ? { label: room } : {}),
  };
}

type Rect = { x: number; y: number; width: number; height: number };

/** Each node's box where layout put it, or where it started if layout left it. */
function placed(data: DiagramData, seeds: readonly GraphNode[], moved: ReadonlyMap<string, Vec2>): Map<string, Rect> {
  return new Map(data.nodes.map((n, i) => {
    const seed = seeds[i]!.bounds;
    const at = moved.get(n.id) ?? seed;
    return [n.id, { x: at.x, y: at.y, width: seed.width, height: seed.height }];
  }));
}

/** A node's box, its rows' text and slots, and its port labels, laid out in `box`. */
function nodeSpecs(
  n: DataNode, body: BodySpec, box: { x: number; y: number; width: number; height: number },
  look: { style: NodeStyle; text: (row: Row | undefined) => DiagramTextStyle; measure: MeasureRowText },
): DiagramSpec[] {
  const { style } = look;
  const textData = (text: string, row: Row | undefined): DiagramSceneData =>
    ({ text, style: look.text(row), fill: { paint: { color: style.text } } });
  const built = buildBody<DiagramSceneData, 'main', RectPose>(body, box, {
    id: n.id,
    layer: 'main',
    measure: look.measure,
    body: (trait) => ({
      diagram: {
        ...trait, ...bodyLayoutOf(body, trait), ...(n.pinned === true ? { pinned: true } : {}), ...(n.style !== undefined ? { style: n.style } : {}),
      },
      fill: { paint: { color: style.fill } },
      stroke: { paint: { color: style.stroke }, width: style.strokeWidth ?? 2, ...(style.dash ? { dash: style.dash } : {}) },
    }),
    row: (text, at) =>
      at.row.kind === 'slot'
        ? (at.row.id === undefined ? null : { diagram: { mark: { d: SLOT_FRAME } }, stroke: { paint: { color: style.stroke }, width: 1 } })
        : text === '' ? null : { ...textData(text, at.row), bodyRow: at.index },
    portLabel: (text) => textData(text, undefined),
  });
  return built.specs.map((s, k) => ({ ...s, ...(s.id !== undefined ? {} : { id: `${n.id}/${k}` }) }) as DiagramSpec);
}

/** Every spec carries an id — a node's own, `<id>/<k>` for its text,
 *  `<id>/mark:<i>` for its marks, `<edge id>/label`, a group's own and
 *  `<group id>/label` — so a later call's
 *  specs can be reconciled against this one's. Throws on a repeated id among
 *  nodes and groups, which names two things as one. An edge whose
 *  end is not a node is dropped, and so is a repeat of an earlier edge with
 *  the same ends, ports and label: it would draw exactly on top of the first. */
export function diagramScene(data: DiagramData, opts: DiagramSceneOptions = {}): DiagramSpec[] {
  const { theme } = opts;
  const font = opts.font ?? (theme ? themeFont(theme) : DEFAULT_FONT);
  const labelFont = theme ? themeLabelFont(theme, font) : font;
  const styleOf = (s: RowTextStyle | undefined) => textFace(s, font);
  const measure: MeasureRowText = opts.measure
    ? (text, s) => opts.measure!(text, { ...s, fontFamily: s.fontFamily ?? font.fontFamily, fontSize: s.fontSize ?? font.fontSize })
    : (text, s) => {
        const size = s.fontSize ?? font.fontSize;
        return { width: text.length * GLYPH * size, height: Math.ceil(LINE * size) };
      };

  const ids = new Set<string>();
  for (const n of data.nodes) {
    if (ids.has(n.id)) throw new Error(`diagramScene: node id "${n.id}" appears more than once`);
    ids.add(n.id);
  }
  const nodeIds = new Set(ids);
  const titleStyle = { ...font, fontSize: font.fontSize - 1 };
  const groups = resolveGroups(data.groups ?? [], ids, nodeIds, {
    padding: opts.groupPadding ?? DEFAULT_GROUP_INSET,
    title: (text) => measure(text, titleStyle),
  });
  const seen = new Set<string>();
  const edges = data.edges.filter((e) => {
    const id = edgeIdOf(e);
    if (seen.has(id) || !ids.has(e.from) || !ids.has(e.to)) return false;
    seen.add(id);
    return true;
  });

  const bodies = data.nodes.map((n) => ({
    outline: n.outline ?? opts.outline ?? 'rect',
    rows: n.rows ?? (n.lines ?? []).map((text): Row => ({ kind: 'label', text })),
    padding: n.padding ?? opts.padding ?? 8,
    gap: n.gap ?? opts.gap ?? 4,
    verticalAlign: n.verticalAlign ?? opts.verticalAlign ?? 'center',
    ...(n.ports ? { ports: n.ports } : {}),
    ...(n.portLabels ? { portLabels: n.portLabels } : {}),
  }));
  // Seeded on the diagonal in source order, so whichever axis a layout reads
  // for in-rank order, it starts from the data's own order.
  const seeds: GraphNode[] = data.nodes.map((n, i) => {
    const pose = sizeToBody(
      { ...(n.at ?? { x: i, y: i }), width: n.width ?? opts.minWidth ?? MIN_WIDTH, height: n.height ?? 0 },
      measureBody(bodies[i]!, measure),
    );
    const { ports, outline, margin } = bodyTrait(bodies[i]!, pose, measure);
    return { id: n.id, bounds: pose, pinned: n.pinned === true, ...(ports !== undefined ? { ports } : {}),
      ...(outline !== undefined ? { outline } : {}), ...(margin !== undefined ? { margin } : {}) };
  });
  const graphGroups: GraphGroup[] = groups.map((g) => ({
    id: g.group.id,
    members: g.members,
    inset: g.inset,
    ...(g.minWidth !== undefined ? { minWidth: g.minWidth } : {}),
    ...(g.parent !== undefined ? { parent: g.parent } : {}),
    ...(g.group.reorder !== undefined ? { ordered: g.direct } : {}),
  }));
  const seedOf = new Map(seeds.map((n) => [n.id, n]));
  for (const g of groups) {
    for (const m of g.direct) {
      const seed = seedOf.get(m);
      if (seed !== undefined) seed.group = g.group.id;
    }
  }
  const graph = graphOf(
    seeds,
    expandGroupEdges(edges.map((e) => graphEdgeOf(e, labelRoomOf(e, opts, labelFont, measure))), graphGroups),
    graphGroups,
  );
  const layout: LayoutFn | null = typeof opts.layout === 'function' ? opts.layout
    : opts.layout === 'none' ? null
    : LAYOUTS[opts.layout ?? 'layered'];
  const layoutOptions: LayoutOptions = { order: 'barycenter', ...opts.layoutOptions };
  const plan = layout === null ? null : planOf(layout, graph, layoutOptions);
  const moved = plan?.moves ?? new Map();

  const specs: DiagramSpec[] = [];
  const placedAt = placed(data, seeds, moved);
  // The author's own ports and waypoints win over the plan's.
  const routes = plan === null || layout?.plan === undefined ? null : authoredOver(edges.map((e) => ({ ...e, id: edgeIdOf(e) })), plan);
  // Behind every node, so a box never paints over what it holds.
  const fallback = theme ? roleEdgeStyle(theme) : EDGE;
  const edgeCtx = { idOf: edgeIdOf, font, labelFont, measure, fallback, labelPlacement: LABEL_PLACEMENT, routes, opts };
  const groupLook = (g: DataGroup) => ({ style: opts.groupStyle?.(g) ?? theme?.container ?? GROUP, text: styleOf(titleStyle) });
  const footprints = new Map(seeds.map((s) => [s.id, grownBy(placedAt.get(s.id)!, s.margin)]));
  specs.push(...groupSpecs(groups, footprints, groupLook, wireLabels(edges, edgeCtx)));
  for (const [i, n] of data.nodes.entries()) {
    const seed = seeds[i]!.bounds;
    const at = placedAt.get(n.id)!;
    const style = opts.nodeStyle?.(n) ?? (theme ? roleStyle(theme, n.style) : NODE);
    specs.push(...nodeSpecs(n, bodies[i]!, { x: at.x, y: at.y, width: seed.width, height: seed.height }, { style, text: (row) => rowTextStyle(row, font), measure }));
    if (n.marks) specs.push(...markSpecs(n.id, n.marks, at, { style, textStyle: styleOf, measure }));
  }
  specs.push(...edgeSpecs(edges, edgeCtx));
  return specs;
}
