import type { MeasureRowText } from '../body';
import { diagramScene, type DataNode, type DiagramRouter, type NodeStyle } from '../fromData';
import type { PortSpec } from '../types';
import {
  boxNode, drawableWires, isControl, kindOf, sceneStyles, typeColors, uniqueGroups, uniqueStages, wireEdges,
  type DrawableWire, type EffectLook, type RunRowOptions, type TypeColor,
} from './draw';
import { inkOf, routeWires, TRACK_GAP, type Box } from './lanesRoutes';
import { mainChain } from './mainChain';
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

/** How far a stage stands inside the first and last lane it touches, at
 *  least: more beside a lane edge that wires run along on several tracks. */
export const LANE_INSET = 6;
/** Around the chart and beside the lane labels. */
const MARGIN = 16;
const LANE_STYLES: readonly NodeStyle[] = [
  { fill: 'rgba(255, 255, 255, 0.035)', stroke: 'rgba(255, 255, 255, 0.06)', text: '#9fbdd6', strokeWidth: 1 },
  { fill: 'rgba(255, 255, 255, 0)', stroke: 'rgba(255, 255, 255, 0.06)', text: '#9fbdd6', strokeWidth: 1 },
];

/** The node id of the lane for a value type. */
export const laneId = (type: string): string => `~lane:${type}`;
/** The value type of the lane `laneId` named, or `undefined` for any other id. */
export const laneTypeOf = (id: string): string | undefined => (id.startsWith('~lane:') ? id.slice('~lane:'.length) : undefined);

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
 *  spans and the insets at their outer edges, the narrowest spans settled
 *  first: growing a lane only ever adds room to a span that already fit. */
function laneHeights(count: number, least: number, needs: readonly { span: Span; height: number }[], insets: readonly number[]): number[] {
  const heights = Array.from({ length: count }, () => least);
  for (const { span: [lo, hi], height } of [...needs].sort((a, b) => (a.span[1] - a.span[0]) - (b.span[1] - b.span[0]))) {
    const short = height + insets[lo]! + insets[hi + 1]! - heights.slice(lo, hi + 1).reduce((a, b) => a + b, 0);
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
    // Level, not the anchor's own heading: off its side's middle that leans
    // toward the corner, and the wire would leave or arrive through another lane.
    return { id: p.id, type: p.type, at: { u, v: (y - box.y) / box.height }, normal: { x: u === 0 ? -1 : 1, y: 0 } };
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

/** How far what a node draws reaches past its box on each side. */
type Overhang = { left: number; top: number; right: number; bottom: number };

/** Each node's size as `diagramScene` would draw it unconstrained, and how
 *  far its marks reach past it: a decision's title and cut values. */
function sizesOf(nodes: readonly DataNode[], measure: MeasureRowText | undefined): Map<string, { box: Box; over: Overhang }> {
  const specs = diagramScene({ nodes, edges: [] }, { layout: 'none', ...(measure !== undefined ? { measure } : {}) });
  const pose = new Map(specs.map((s) => [s.id as string, s.pose as Box]));
  return new Map(nodes.map((n) => {
    const box = pose.get(n.id)!;
    const ink = inkOf(n.id, specs);
    const over = {
      left: box.x - Math.min(...ink.map((b) => b.x)),
      top: box.y - Math.min(...ink.map((b) => b.y)),
      right: Math.max(...ink.map((b) => b.x + b.width)) - box.x - box.width,
      bottom: Math.max(...ink.map((b) => b.y + b.height)) - box.y - box.height,
    };
    return [n.id, { box, over }];
  }));
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

/** Each lane edge's inset: `LANE_INSET`, grown so the wires running along
 *  it on `tracks` tracks sit `TRACK_GAP` apart and that far from the stages
 *  either side. The chart's top and bottom edges take their tracks inward. */
function insetsFor(edges: number, tracks: ReadonlyMap<number, number>): number[] {
  return Array.from({ length: edges }, (_, k) => {
    const n = tracks.get(k) ?? 0;
    return LANE_INSET + (k === 0 || k === edges - 1 ? n * TRACK_GAP : Math.max(0, n - 1) * TRACK_GAP / 2);
  });
}

/** What `place` reads: the stages as drawn unconstrained, where they go, and the room to give them. */
interface Plan {
  stages: readonly EffectStage[];
  drawn: readonly DataNode[];
  size: ReadonlyMap<string, { box: Box; over: Overhang }>;
  spans: ReadonlyMap<string, Span>;
  column: ReadonlyMap<string, number>;
  lane: ReadonlyMap<string, number>;
  rows: number;
  least: number;
  gap: number;
  start: number;
}

/** The lanes cut to fit, and each stage stood across its lanes in its column,
 *  inside `insets` of the lane edges above and below it, with what it draws
 *  outside its box kept inside its lanes and its column too. */
function place(plan: Plan, insets: readonly number[]) {
  const { stages, size, spans, column } = plan;
  const inkHeight = (id: string) => size.get(id)!.box.height + size.get(id)!.over.top + size.get(id)!.over.bottom;
  const heights = laneHeights(plan.rows, plan.least, stages.map((s) => ({ span: spans.get(s.id)!, height: inkHeight(s.id) })), insets);
  const tops = heights.map((_, i) => heights.slice(0, i).reduce((a, b) => a + b, 0));
  const band = (i: number): [number, number] => [tops[i]!, tops[i]! + heights[i]!];

  const stood = new Map(stages.map((stage) => {
    const { box: natural, over } = size.get(stage.id)!;
    const [lo, hi] = spans.get(stage.id)!;
    const top = band(lo)[0] + insets[lo]!;
    const span = band(hi)[1] - insets[hi + 1]! - top;
    const kind = kindOf(stage);
    const height = kind === 'decision' ? natural.height : span - over.top - over.bottom;
    // A stadium's rows sit between its round ends, which grow with its height.
    const width = kind === 'source' || kind === 'sink' ? natural.width + Math.max(0, height - natural.height) : natural.width;
    return [stage.id, { y: top + (span - height - over.top - over.bottom) / 2 + over.top, height, width, over }];
  }));
  const inkWidth = (id: string) => stood.get(id)!.width + stood.get(id)!.over.left + stood.get(id)!.over.right;

  const widths: number[] = [];
  for (const s of stages) widths[column.get(s.id)!] = Math.max(widths[column.get(s.id)!] ?? 0, inkWidth(s.id));
  const lefts = Array.from(widths, (_, c) => plan.start + Array.from(widths.slice(0, c), (wd) => (wd ?? 0) + plan.gap).reduce((a, b) => a + b, 0));

  const nodes = stages.map((stage, k): DataNode => {
    const c = column.get(stage.id)!;
    const { y, height, width, over } = stood.get(stage.id)!;
    const box = { x: lefts[c]! + (widths[c]! - inkWidth(stage.id)) / 2 + over.left, y, width, height };
    return {
      ...plan.drawn[k]!,
      at: { x: box.x, y: box.y },
      width: box.width,
      height: box.height,
      ...(kindOf(stage) === 'decision' ? {} : { ports: lanePorts(stage, box, plan.lane, band) }),
    };
  });
  const columns = Array.from(widths, (wd, c) => [lefts[c]!, lefts[c]! + (wd ?? 0)] as const);
  const edges = [...tops, tops.length === 0 ? 0 : tops[tops.length - 1]! + heights[heights.length - 1]!];
  return { nodes, tops, heights, columns, edges };
}

/** The lanes look: a horizontal lane per value type, and each stage standing
 *  across the lanes of the types it reads and writes, as tall as they are,
 *  its ports in their own lanes. A decision keeps its symbol's size, centered
 *  across its lanes. Columns run left to right in the order the signal flows.
 *  A wire runs around the stages between its ends along the lane edges, each
 *  sharing one on a track of its own. */
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
  const column = columnsOf(stages, drawableWires(pipeline), spans);
  const plan: Plan = {
    stages, drawn, size, spans, column, lane, rows: rows.length,
    least: Math.max(options.laneHeight ?? 48, ...labels.map((l) => size.get(l.id)!.box.height)),
    gap: options.rankGap ?? 40,
    start: 2 * MARGIN + Math.max(0, ...labels.map((l) => size.get(l.id)!.box.width)),
  };
  const router = options.router ?? 'bezier';
  const wires = wireEdges(pipeline, color);

  // Wires choose their corridors by lane, so widening one moves no wire onto
  // another; a few rounds settle each corridor's tracks.
  let insets = insetsFor(rows.length + 1, new Map());
  let laid = place(plan, insets);
  let routed = routeWires(wires, laid.nodes, { grid: laid, column, router, measure: options.measure });
  for (let round = 0; round < 4; round++) {
    const need = insetsFor(rows.length + 1, routed.tracks);
    if (need.every((n, k) => n <= insets[k]!)) break;
    insets = need.map((n, k) => Math.max(n, insets[k]!));
    laid = place(plan, insets);
    routed = routeWires(wires, laid.nodes, { grid: laid, column, router, measure: options.measure });
  }

  const { columns, tops, heights } = laid;
  const right = columns.length === 0 ? plan.start : columns[columns.length - 1]![1] + MARGIN;
  const laneNodes = rows.map((t, i) => laneNode(t, { x: 0, y: tops[i]!, width: right, height: heights[i]! }, color));
  const edges = routed.edges;
  const styles = sceneStyles(stages, edges);
  const laneStyle = new Map(rows.map((t, i) => [laneId(t), LANE_STYLES[i % LANE_STYLES.length]!]));

  return {
    data: { nodes: [...laneNodes, ...laid.nodes], edges: edges.map((e) => e.edge), groups: uniqueGroups(pipeline) },
    scene: {
      layout: 'none',
      router,
      ...(options.measure !== undefined ? { measure: options.measure } : {}),
      ...styles,
      nodeStyle: (n) => laneStyle.get(n.id) ?? styles.nodeStyle(n),
    },
    color,
    order: { axis: 'x', items: mainChain(pipeline).map((id) => ({ id })) },
    ...(types.length > 0 ? {
      laneOrder: {
        axis: 'y' as const,
        items: types.map((t, i) => ({ id: laneId(t), grip: { x: 0, y: tops[i]!, width: plan.start, height: heights[i]! } })),
      },
    } : {}),
  };
};
