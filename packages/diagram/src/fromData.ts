/**
 * `diagramScene` — a laid-out diagram from plain `{ nodes, edges }`.
 *
 * Every box is a `buildBody` body, so a data node can say anything a body
 * can: outline, rows, padding, ports. Sizes are estimated from character
 * counts unless `measure` is given, so layout runs without a canvas and gives
 * the same answer in node and in a browser.
 */
import type { RectPose } from '@weasel-js/core';
import { DEFAULT_GROUP_INSET, expandGroupEdges } from './cluster';
import { placeContainers, containerSpecs } from './dataContainerPlace';
import { containerLayoutNodes, resolveContainers, type ContainerLayout } from './dataContainers';
import { groupSpecs, resolveGroups, type ResolvedGroup } from './dataGroups';
import { bodyLayoutOf } from './bodyRelayout';
import { bodyTrait, buildBody, measureBody, sizeToBody, type BodySpec, type MeasureRowText, type Row, type RowTextStyle } from './body';
import { edgeIdOf } from './edgeId';
import { ownNodeStyle, withColors } from './dataColors';
import { dataNodeStyle } from './dataStyles';
import { scenePageSplits } from './dataPages';
import { edgeSpecs, wireLabels } from './dataEdges';
import {
  NODE, NODE_STROKE_WIDTH,
  type DataEdge, type DataGroup, type DataNode, type DiagramData, type DiagramSceneData, type DiagramSceneOptions, type DiagramSpec,
  type NodeStyle,
} from './dataTypes';
import { DEFAULT_FONT, GLYPH, labelSize, labelStyleOf } from './edgeLabel';
import { force } from './force';
import { grownBy } from './footprint';
import { graphOf, labelFollowsLayout, type EdgeLabelRoom, type GraphEdge, type GraphGroup, type GraphNode } from './graph';
import { LABEL_PLACEMENT } from './labelTrait';
import { chain } from './chain';
import { rowTextStyle, textFace, type DiagramTextStyle } from './rowStyle';
import { layered } from './layered';
import { planOf, type LayoutFn, type LayoutOptions, type LayoutPlan } from './layout';
import { markSpecs } from './marks';
import { authoredOver } from './route';
import { diagramThemeFrom, themeFont, themeLabelFont } from './theme/resolve';
import { offPageTagLook } from './offPage/tag';
import { tree } from './tree';
import type { Vec2 } from '@weasel-js/core/math';

export type { DiagramTextStyle };
export { NODE };
export type {
  DataEdge, DataGroup, DataNode, DiagramData, DiagramRouter, DiagramSceneData, DiagramSceneOptions, DiagramSpec, EdgeStyle, NodeStyle,
} from './dataTypes';

/** The frame an empty slot with an id draws, in the unit square a mark is drawn in. */
export const SLOT_FRAME = 'M0 0H1V1H0Z';

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
        ...ownNodeStyle(n.colors),
      },
      fill: { paint: { color: style.fill } },
      stroke: { paint: { color: style.stroke }, width: style.strokeWidth ?? NODE_STROKE_WIDTH, ...(style.dash ? { dash: style.dash } : {}) },
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
 *  `<group id>/label`, a region's own and `<region id>/title` — so a later call's
 *  specs can be reconciled against this one's. Throws on a repeated id among
 *  nodes, groups, containers and lanes, which names two things as one. An edge whose
 *  end is not a node is dropped, and so is a repeat of an earlier edge with
 *  the same ends, ports and label: it would draw exactly on top of the first. */
export function diagramScene<TLayer extends string>(data: DiagramData, opts: DiagramSceneOptions<TLayer> & { layer: TLayer }): DiagramSpec<TLayer>[];
export function diagramScene(data: DiagramData, opts?: DiagramSceneOptions): DiagramSpec[];
export function diagramScene<TLayer extends string>(data: DiagramData, opts: DiagramSceneOptions<TLayer> = {}): DiagramSpec<TLayer>[] {
  const { layer, ...rest } = opts;
  const specs = mainSpecs(data, rest);
  return (layer === undefined ? specs : specs.map((s) => ({ ...s, layer }))) as DiagramSpec<TLayer>[];
}

/** {@link diagramScene}'s specs, on `main`. */
function mainSpecs(data: DiagramData, opts: DiagramSceneOptions): DiagramSpec[] {
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
  const pad = opts.groupPadding ?? DEFAULT_GROUP_INSET;
  const regions = resolveContainers(data.containers ?? [], ids, nodeIds);
  // A region is a node's scene parent and a group only gathers it for layout and draws around it: a
  // node in both would have two owners whose boxes disagree, so the data is refused rather than guessed at.
  for (const g of data.groups ?? []) {
    for (const m of g.members) {
      const region = nodeIds.has(m) ? regions.parentOf.get(m) : undefined;
      if (region !== undefined) throw new Error(`diagramScene: node "${m}" is in group "${g.id}" and in region "${region}"; a node may be in one or the other`);
    }
  }
  const boxes = containerLayoutNodes(regions, { padding: pad, seed: (k) => ({ x: data.nodes.length + k, y: data.nodes.length + k }) });
  const titleStyle = { ...font, fontSize: font.fontSize - 1 };
  const groups = resolveGroups(data.groups ?? [], ids, new Set([...nodeIds].filter((id) => !boxes.hidden.has(id))), {
    padding: pad,
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
  const laid = layOut(seeds, edges, groups, boxes, opts, (e) => labelRoomOf(e, opts, labelFont, measure));

  const specs: DiagramSpec[] = [];
  const sizes = new Map(data.nodes.map((n, i) => [n.id, { ...seeds[i]!.bounds, ...(n.at ? { at: n.at } : {}),
    ...(seeds[i]!.margin ? { margin: seeds[i]!.margin } : {}) }]));
  const placedAt = new Map([...laid.placed, ...placeContainers(regions, boxes, laid.placed, sizes, pad)]);
  // The author's own ports and waypoints win over the plan's; an edge layout ranked against a region keeps none of the plan's.
  const routes = laid.plan === null ? null
    : authoredOver(edges.filter((e) => !laid.remapped.has(e)).map((e) => ({ ...e, id: edgeIdOf(e) })), laid.plan);
  const edgeCtx = { idOf: edgeIdOf, font, labelFont, measure, labelPlacement: LABEL_PLACEMENT, routes, opts, ...(theme ? { theme } : {}) };
  const groupLook = (g: DataGroup) => ({ style: opts.groupStyle?.(g) ?? theme?.container ?? GROUP, text: styleOf(titleStyle) });
  const footprints = new Map([...placedAt, ...seeds.map((s) => [s.id, grownBy(placedAt.get(s.id)!, s.margin)] as const)]);
  // Regions and group boxes first, so a box never paints over what it holds.
  specs.push(...containerSpecs(regions, placedAt, theme, font.fontFamily));
  specs.push(...groupSpecs(groups, footprints, groupLook, wireLabels(edges, edgeCtx)));
  for (const [i, n] of data.nodes.entries()) {
    const seed = seeds[i]!.bounds;
    const at = placedAt.get(n.id)!;
    const own = opts.nodeStyle?.(n);
    const style = own !== undefined ? withColors(own, n.colors) : dataNodeStyle(n, theme);
    const parent = regions.parentOf.get(n.id);
    const built = nodeSpecs(n, bodies[i]!, { x: at.x, y: at.y, width: seed.width, height: seed.height }, { style, text: (row) => rowTextStyle(row, font), measure });
    specs.push(...(parent === undefined ? built : built.map((s) => (s.id === n.id ? { ...s, parent: parent as never } : s))));
    if (n.marks) specs.push(...markSpecs(n.id, n.marks, at, { style, textStyle: styleOf, measure }));
  }
  const pages = scenePageSplits(data, placedAt, specs, edges.map((e) => ({ id: edgeIdOf(e), from: e.from, to: e.to })),
    () => ({ ...offPageTagLook(theme ?? diagramThemeFrom(undefined)), measure }));
  specs.push(...edgeSpecs(edges, pages === null ? edgeCtx : { ...edgeCtx, splits: pages.splits }), ...(pages?.tags ?? []));
  return specs;
}

/**
 * Lay out what layout sees: every node outside a boxed region, each outermost
 * boxed region as one node, and the groups and fitted containers around
 * them. An edge with an end inside a boxed region ranks against the
 * outermost one, and one with both ends inside the same one ranks nothing.
 */
function layOut(
  seeds: readonly GraphNode[],
  edges: readonly DataEdge[],
  groups: readonly ResolvedGroup[],
  boxes: ContainerLayout,
  opts: DiagramSceneOptions,
  room: (e: DataEdge) => EdgeLabelRoom | null,
): { placed: Map<string, Rect>; plan: LayoutPlan | null; remapped: ReadonlySet<DataEdge> } {
  const graphGroups: GraphGroup[] = [...groups.map((g) => ({
    id: g.group.id,
    members: g.members,
    inset: g.inset,
    ...(g.minWidth !== undefined ? { minWidth: g.minWidth } : {}),
    ...(g.parent !== undefined ? { parent: g.parent } : {}),
    ...(g.group.reorder !== undefined ? { ordered: g.direct } : {}),
  })), ...boxes.groups];
  const visible = [...seeds.filter((s) => !boxes.hidden.has(s.id)), ...boxes.nodes];
  const seedOf = new Map(visible.map((n) => [n.id, n]));
  for (const [id, group] of boxes.groupOf) seedOf.get(id)!.group = group;
  for (const g of groups) {
    for (const m of g.direct) {
      const seed = seedOf.get(m);
      if (seed !== undefined) seed.group = g.group.id;
    }
  }
  const remapped = new Set<DataEdge>();
  const graphEdges = edges.flatMap((e): GraphEdge[] => {
    const edge = graphEdgeOf(e, room(e));
    const from = boxes.endOf(e.from);
    const to = boxes.endOf(e.to);
    if (from === e.from && to === e.to) return [edge];
    remapped.add(e);
    if (from === to) return [];
    const { fromPort: _f, toPort: _t, ...rest } = edge;
    return [{ ...rest, from, to, ...(from === e.from && e.fromPort ? { fromPort: e.fromPort } : {}),
      ...(to === e.to && e.toPort ? { toPort: e.toPort } : {}) }];
  });
  const graph = graphOf(visible, expandGroupEdges(graphEdges, graphGroups), graphGroups);
  const layout: LayoutFn | null = typeof opts.layout === 'function' ? opts.layout
    : opts.layout === 'none' ? null
    : LAYOUTS[opts.layout ?? 'layered'];
  const layoutOptions: LayoutOptions = { order: 'barycenter', ...opts.layoutOptions };
  const plan = layout === null ? null : planOf(layout, graph, layoutOptions);
  const moved = plan?.moves ?? new Map<string, Vec2>();
  const placed = new Map(visible.map((n) => {
    const at = moved.get(n.id) ?? n.bounds;
    return [n.id, { x: at.x, y: at.y, width: n.bounds.width, height: n.bounds.height }];
  }));
  return { placed, plan: layout?.plan === undefined ? null : plan, remapped };
}
