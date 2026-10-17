import type { MeasureRowText } from '../body';
import {
  diagramScene, edgeIdOf, LABEL_PLACEMENT, type DataEdge, type DataNode, type DiagramRouter, type DiagramSpec, type EdgeStyle, type NodeStyle,
} from '../fromData';
import { portSitesOf } from '../ports';
import type { PortSpec } from '../types';
import {
  boxNode, drawableWires, isControl, kindOf, sceneStyles, typeColors, uniqueGroups, uniqueStages, wireEdges,
  type DrawableWire, type EffectLook, type RunRowOptions, type TypeColor,
} from './draw';
import { clearLabel, laneWaypoints, routeOf, type Box, type LaneEnd, type LaneGrid } from './lanesRoutes';
import { branchNode, type BranchChoice } from './symbols';
import type { EffectPipeline, EffectPort, EffectStage } from './types';

/** Options for the `lanes` look. */
export interface LanesOptions extends RunRowOptions {
  /** The value types whose lanes come first, top down. The rest follow in
   *  the order their types first appear on the pipeline's ports. */
  lanes?: readonly string[];
  /** The least height of a lane. A lane grows past it until what stands in
   *  it fits. Default 48. */
  laneHeight?: number;
  /** Between one column of stages and the next. Default 40. */
  rankGap?: number;
  /** Default `'bezier'`. */
  router?: DiagramRouter;
  /** A color per value type, over the palette's own. */
  colors?: Readonly<Record<string, string>>;
  /** Whether a stage lists its `params`. Default true. */
  showParams?: boolean;
  /** Default `'auto'`. */
  branch?: BranchChoice;
  /** Measures text, as `diagramScene` takes it, for sizing stages before
   *  the lanes are cut to fit them. It is handed on in the look's `scene`. */
  measure?: MeasureRowText;
}

/** How far a stage stands inside the first and last lane it touches. */
export const LANE_INSET = 6;
/** Around the chart and beside the lane labels. */
const MARGIN = 16;
const LANE_STYLES: readonly NodeStyle[] = [
  { fill: 'rgba(255, 255, 255, 0.035)', stroke: 'rgba(255, 255, 255, 0.06)', text: '#9fbdd6', strokeWidth: 1 },
  { fill: 'rgba(255, 255, 255, 0)', stroke: 'rgba(255, 255, 255, 0.06)', text: '#9fbdd6', strokeWidth: 1 },
];

/** The node id of the lane for a value type. */
export const laneId = (type: string): string => `~lane:${type}`;

/** A stage's span: the first and last lane it touches. */
type Span = readonly [number, number];

/** Lane types top down: `first` that the pipeline uses, then the rest in order of first appearance. */
function laneTypes(stages: readonly EffectStage[], first: readonly string[] = []): string[] {
  const used = [...new Set(stages.flatMap((s) => [...(s.inputs ?? []), ...(s.outputs ?? [])].map((p) => p.type)))];
  const lead = [...new Set(first)].filter((t) => used.includes(t));
  return [...lead, ...used.filter((t) => !lead.includes(t))];
}

function spanOf(stage: EffectStage, lane: ReadonlyMap<string, number>): Span {
  const at = [...(stage.inputs ?? []), ...(stage.outputs ?? [])].map((p) => lane.get(p.type)!);
  return at.length === 0 ? [0, 0] : [Math.min(...at), Math.max(...at)];
}

/** Each stage's column: right of every stage feeding it, and right again
 *  past any column where a stage already holds one of its lanes. On a loop
 *  the first stage left in source order goes next. */
function columnsOf(stages: readonly EffectStage[], wires: readonly DrawableWire[], spans: ReadonlyMap<string, Span>): Map<string, number> {
  const feeds = new Map<string, Set<string>>(stages.map((s) => [s.id, new Set()]));
  for (const d of wires) if (d.wire.from.stage !== d.wire.to.stage) feeds.get(d.wire.to.stage)!.add(d.wire.from.stage);
  const column = new Map<string, number>();
  const held: Span[][] = [];
  const left = [...stages];
  while (left.length > 0) {
    const i = Math.max(0, left.findIndex((s) => [...feeds.get(s.id)!].every((f) => column.has(f))));
    const stage = left.splice(i, 1)[0]!;
    const span = spans.get(stage.id)!;
    let c = Math.max(0, ...[...feeds.get(stage.id)!].flatMap((f) => (column.has(f) ? [column.get(f)! + 1] : [])));
    while (held[c]?.some(([lo, hi]) => lo <= span[1] && span[0] <= hi)) c++;
    (held[c] ??= []).push(span);
    column.set(stage.id, c);
  }
  return column;
}

/** Lane heights from `least`, each grown until every stage fits the lanes it
 *  spans, the narrowest spans settled first: growing a lane only ever adds
 *  room to a span that already fit. */
function laneHeights(count: number, least: number, needs: readonly { span: Span; height: number }[]): number[] {
  const heights = Array.from({ length: count }, () => least);
  for (const { span: [lo, hi], height } of [...needs].sort((a, b) => (a.span[1] - a.span[0]) - (b.span[1] - b.span[0]))) {
    const short = height + 2 * LANE_INSET - heights.slice(lo, hi + 1).reduce((a, b) => a + b, 0);
    if (short > 0) for (let i = lo; i <= hi; i++) heights[i]! += short / (hi - lo + 1);
  }
  return heights;
}

/** An ordinary stage's ports, inputs on its left edge and outputs on its
 *  right, each spread within the stretch of its own type's lane the box covers. */
function lanePorts(stage: EffectStage, box: Box, lane: ReadonlyMap<string, number>, band: (i: number) => [number, number]): PortSpec[] {
  const side = (ports: readonly EffectPort[], u: number): PortSpec[] => ports.map((p) => {
    const same = ports.filter((q) => q.type === p.type);
    const [top, bottom] = band(lane.get(p.type)!);
    const a = Math.max(top, box.y);
    const b = Math.min(bottom, box.y + box.height);
    const y = a + ((b - a) * (same.indexOf(p) + 1)) / (same.length + 1);
    return { id: p.id, type: p.type, at: { u, v: (y - box.y) / box.height } };
  });
  return [...side(stage.inputs ?? [], 0), ...side(stage.outputs ?? [], 1)];
}

/** `'bottom'` when a decision's control inputs sit in lanes below the rest of its ports. */
function controlSideOf(stage: EffectStage, pipeline: EffectPipeline, lane: ReadonlyMap<string, number>): 'top' | 'bottom' {
  const ports = [...(stage.inputs ?? []), ...(stage.outputs ?? [])];
  const mean = (ps: readonly EffectPort[]) => ps.reduce((a, p) => a + lane.get(p.type)!, 0) / ps.length;
  const control = ports.filter((p) => isControl(pipeline, p.type));
  const signal = ports.filter((p) => !isControl(pipeline, p.type));
  return control.length > 0 && signal.length > 0 && mean(control) > mean(signal) ? 'bottom' : 'top';
}

/** Each node's size as `diagramScene` would draw it unconstrained. */
function sizesOf(nodes: readonly DataNode[], measure: MeasureRowText | undefined): Map<string, Box> {
  const specs = diagramScene({ nodes, edges: [] }, { layout: 'none', ...(measure !== undefined ? { measure } : {}) });
  const ids = new Set(nodes.map((n) => n.id));
  return new Map(specs.filter((s) => ids.has(s.id as string)).map((s) => [s.id as string, s.pose as Box]));
}

function laneNode(type: string, box: Box, color: TypeColor): DataNode {
  return {
    id: laneId(type),
    lines: [],
    ports: [],
    at: { x: box.x, y: box.y },
    width: box.width,
    height: box.height,
    marks: [{ text: type, at: { u: 0, v: 0.5 }, self: { u: 0, v: 0.5 }, offset: { x: MARGIN, y: 0 }, color: color(type), style: { bold: true } }],
  };
}

/** What `routeWires` reads of the laid-out chart. */
interface Laid {
  grid: Omit<LaneGrid, 'ink'>;
  column: ReadonlyMap<string, number>;
  router: DiagramRouter;
  measure: MeasureRowText | undefined;
}

/** What a node draws: its box, and each of its rows and marks, some of which sit outside it. */
const inkOf = (id: string, specs: readonly DiagramSpec[]): Box[] =>
  specs.filter((s) => s.id === id || s.parent === id || String(s.id).startsWith(`${id}/mark:`)).map((s) => s.pose as Box);

/** Each wire's edge, given the waypoints that keep it clear of the stages it
 *  passes and, when it is labeled, a place for its label that covers none. */
function routeWires(
  wires: readonly { edge: DataEdge; style: EdgeStyle }[], nodes: readonly DataNode[], laid: Laid,
): { edge: DataEdge; style: EdgeStyle }[] {
  const specs = diagramScene({ nodes, edges: wires.map((w) => w.edge) }, {
    layout: 'none', router: laid.router, ...(laid.measure !== undefined ? { measure: laid.measure } : {}),
  });
  const spec = new Map(specs.map((s) => [s.id as string, s]));
  const ink = new Map(nodes.map((n) => [n.id, inkOf(n.id, specs)]));
  const grid: LaneGrid = { ...laid.grid, ink: laid.grid.columns.map((_, c) => [...ink].flatMap(([id, b]) => (laid.column.get(id) === c ? b : []))) };
  const keepOut = [...ink.values()].flat();
  const offset = LABEL_PLACEMENT.offset ?? 0;
  const end = (stage: string, port: string): LaneEnd => {
    const s = spec.get(stage)!;
    const site = portSitesOf({ id: stage, data: s.data } as never, s.pose, port)[0];
    return { column: laid.column.get(stage)!, point: site?.point ?? { x: 0, y: 0 }, normal: site?.normal ?? null };
  };
  return wires.map(({ edge, style }) => {
    const from = end(edge.from, edge.fromPort!);
    const to = end(edge.to, edge.toPort!);
    const waypoints = edge.from === edge.to ? undefined : laneWaypoints(grid, from, to);
    const routed: DataEdge = waypoints === undefined ? edge : { ...edge, routed: waypoints };
    const label = spec.get(`${edgeIdOf(edge)}/label`)?.pose as Box | undefined;
    const path = label === undefined ? null : routeOf(spec.get(edge.from)!, edge.fromPort!, spec.get(edge.to)!, edge.toPort!, laid.router, waypoints);
    const clear = path === null || label === undefined ? undefined : clearLabel(path, label, offset, keepOut);
    if (clear === undefined) return { edge: routed, style };
    keepOut.push(clear.box);
    return { edge: { ...routed, labelPlacement: { at: { near: clear.near }, offset: clear.offset } }, style };
  });
}

/** The lanes look: a horizontal lane per value type, and each stage standing
 *  across the lanes of the types it reads and writes, as tall as they are,
 *  its ports in their own lanes. A decision keeps its symbol's size, centered
 *  across its lanes. Columns run left to right in the order the signal flows. */
export const lanes: EffectLook<LanesOptions> = (pipeline, options = {}) => {
  const color = typeColors(pipeline, options.colors);
  const stages = uniqueStages(pipeline);
  const types = laneTypes(stages, options.lanes);
  const rows = types.length > 0 ? types : [''];
  const lane = new Map(types.map((t, i) => [t, i]));
  const spans = new Map(stages.map((s) => [s.id, spanOf(s, lane)]));
  const drawn = stages.map((stage): DataNode => (kindOf(stage) === 'decision'
    ? { id: stage.id, ...branchNode(stage, pipeline, options.branch, { controlSide: controlSideOf(stage, pipeline, lane) }) }
    : boxNode(stage, { showParams: options.showParams !== false, rowPorts: false, ports: [], run: options })));
  const labels = rows.map((t): DataNode => ({ id: laneId(t), lines: [t] }));
  const size = sizesOf([...drawn, ...labels], options.measure);

  const least = Math.max(options.laneHeight ?? 48, ...labels.map((l) => size.get(l.id)!.height));
  const heights = laneHeights(rows.length, least, stages.map((s) => ({ span: spans.get(s.id)!, height: size.get(s.id)!.height })));
  const tops = heights.map((_, i) => heights.slice(0, i).reduce((a, b) => a + b, 0));
  const band = (i: number): [number, number] => [tops[i]!, tops[i]! + heights[i]!];

  const stood = new Map(stages.map((stage) => {
    const natural = size.get(stage.id)!;
    const [lo, hi] = spans.get(stage.id)!;
    const top = band(lo)[0] + LANE_INSET;
    const span = band(hi)[1] - LANE_INSET - top;
    const kind = kindOf(stage);
    const height = kind === 'decision' ? natural.height : span;
    // A stadium's rows sit between its round ends, which grow with its height.
    const width = kind === 'source' || kind === 'sink' ? natural.width + Math.max(0, height - natural.height) : natural.width;
    return [stage.id, { top, span, height, width }];
  }));

  const column = columnsOf(stages, drawableWires(pipeline), spans);
  const widths: number[] = [];
  for (const s of stages) widths[column.get(s.id)!] = Math.max(widths[column.get(s.id)!] ?? 0, stood.get(s.id)!.width);
  const gap = options.rankGap ?? 40;
  const start = 2 * MARGIN + Math.max(0, ...labels.map((l) => size.get(l.id)!.width));
  const lefts = Array.from(widths, (_, c) => start + Array.from(widths.slice(0, c), (wd) => (wd ?? 0) + gap).reduce((a, b) => a + b, 0));
  const right = widths.length === 0 ? start : lefts[widths.length - 1]! + (widths[widths.length - 1] ?? 0) + MARGIN;

  const nodes = stages.map((stage, k): DataNode => {
    const c = column.get(stage.id)!;
    const { top, span, height, width } = stood.get(stage.id)!;
    const decision = kindOf(stage) === 'decision';
    const box = { x: lefts[c]! + (widths[c]! - width) / 2, y: top + (span - height) / 2, width, height };
    const node = drawn[k]!;
    return {
      ...node,
      at: { x: box.x, y: box.y },
      width: box.width,
      height: box.height,
      ...(decision ? {} : { ports: lanePorts(stage, box, lane, band) }),
    };
  });
  const laneNodes = rows.map((t, i) => laneNode(t, { x: 0, y: tops[i]!, width: right, height: heights[i]! }, color));
  const router = options.router ?? 'bezier';
  const grid = {
    columns: Array.from(widths, (wd, c) => [lefts[c]!, lefts[c]! + (wd ?? 0)] as const),
    edges: [...tops, tops.length === 0 ? 0 : tops[tops.length - 1]! + heights[heights.length - 1]!],
  };
  const edges = routeWires(wireEdges(pipeline, color), nodes, { grid, column, router, measure: options.measure });
  const styles = sceneStyles(stages, edges);
  const laneStyle = new Map(rows.map((t, i) => [laneId(t), LANE_STYLES[i % LANE_STYLES.length]!]));

  return {
    data: { nodes: [...laneNodes, ...nodes], edges: edges.map((e) => e.edge), groups: uniqueGroups(pipeline) },
    scene: {
      layout: 'none',
      router,
      ...(options.measure !== undefined ? { measure: options.measure } : {}),
      ...styles,
      nodeStyle: (n) => laneStyle.get(n.id) ?? styles.nodeStyle(n),
    },
    color,
  };
};
