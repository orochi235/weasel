/** What every look shares: how a type is colored, how a stage and a wire are
 *  styled, and the lookups a look does over a pipeline. */
import type { Row } from '../body';
import { edgeIdOf, type DataEdge, type DataNode, type DiagramData, type DiagramSceneOptions, type EdgeStyle, type NodeStyle } from '../fromData';
import { DIAGRAM_THEMES } from '../theme/themes';
import type { DiagramTheme } from '../theme/types';
import type { PortSpec } from '../types';
import { checkPipeline } from './check';
import { formatParam } from './stageTypes';
import type { EffectGroup, EffectPipeline, EffectPort, EffectStage, EffectWire } from './types';

/** The color of a value type, for a port or a wire. Answers `undefined`, a
 *  port with no type, with a neutral color. */
export type TypeColor = (type: string | undefined) => string;

/** What a look hands back: `diagramScene`'s two arguments, and its colors. */
export interface EffectLookResult {
  data: DiagramData;
  scene: DiagramSceneOptions;
  color: TypeColor;
  /** Edges standing in for a decision's exits where the look draws no
   *  decision, keyed by edge id: which stage chose, and by which output. A
   *  run reads that stage's `taken` for them. */
  exits?: ReadonlyMap<string, { stage: string; port: string }>;
  /** The stages on the main line, in the order the look draws them, for a
   *  reorder to drag along. Looks that place stages freely leave it out. */
  order?: LookOrder;
  /** The lanes, top down, where the look draws lanes. */
  laneOrder?: LookOrder;
}

/** A sequence a look draws: the scene node ids of its items in order along
 *  `axis`. `slotReorder`'s `sequenceSlots` turns it into slots once the items
 *  have drawn boxes. */
export interface LookOrder {
  axis: 'x' | 'y';
  /** `grip` is where a press picks the item up, in world units; default its drawn box. */
  items: readonly { id: string; grip?: { x: number; y: number; width: number; height: number } }[];
}

/** One way of drawing a pipeline. Unparameterized, a look whose options are
 *  not known: any look fits it, and it is called with none. */
export type EffectLook<TOptions = never> = (pipeline: EffectPipeline, options?: TOptions) => EffectLookResult;

/** The theme the shipped looks draw in when their options name none. */
export const LOOK_THEME: DiagramTheme = DIAGRAM_THEMES.night!;

/** The option every shipped look takes for its colors. */
export interface LookThemeOptions {
  /** Stages take its default role, bypassed ones its muted role; value types its `series` in
   *  turn; groups its container; lanes its lane bodies. Default `night`. */
  theme?: DiagramTheme;
}

const UNTYPED = '#8aa2b5';
/** The color `wireStyle` draws a wire in when `checkPipeline` reported it. */
export const PROBLEM_COLOR = '#ff5d5d';

const BYPASSED_DASH = [4, 3];

/** A color per type: the one given, or the next in `series` in the order
 *  types first appear on the pipeline's ports. */
export function typeColors(
  pipeline: EffectPipeline, given: Readonly<Record<string, string>> = {}, series: readonly string[] = LOOK_THEME.series,
): TypeColor {
  const colors = new Map<string, string>();
  for (const stage of pipeline.stages) {
    for (const port of [...(stage.inputs ?? []), ...(stage.outputs ?? [])]) {
      if (colors.has(port.type)) continue;
      colors.set(port.type, given[port.type] ?? series[colors.size % series.length]!);
    }
  }
  return (type) => (type === undefined ? UNTYPED : colors.get(type) ?? given[type] ?? UNTYPED);
}

/** Whether `type` is one the pipeline's `types` mark as `control`. */
export function isControl(pipeline: EffectPipeline, type: string | undefined): boolean {
  return type !== undefined && pipeline.types?.[type]?.control === true;
}

/** The node style the shipped looks give a stage: the theme's default role, or dashed in its
 *  muted role when the stage is bypassed. */
export function stageStyle(stage: EffectStage, theme: DiagramTheme = LOOK_THEME): NodeStyle {
  const { roles, defaultRole } = theme;
  return stage.bypassed === true ? { ...(roles.muted ?? roles[defaultRole]!), dash: BYPASSED_DASH } : roles[defaultRole]!;
}

/** The edge style the shipped looks give a wire: `color`, dashed for a
 *  control wire, and `PROBLEM_COLOR` in place of `color` for a flagged one. */
export function wireStyle(color: string, control: boolean, problem: boolean): EdgeStyle {
  return {
    stroke: problem ? PROBLEM_COLOR : color,
    width: 2,
    markerEnd: null,
    ...(control ? { dash: [5, 4] } : {}),
  };
}

/** Stages with the repeats dropped, first one kept. `diagramScene` throws on
 *  a repeated id, so a look builds its nodes from these. */
export function uniqueStages(pipeline: EffectPipeline): EffectStage[] {
  const seen = new Set<string>();
  return pipeline.stages.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

/** Groups with the repeats dropped, first one kept, and none that has the id
 *  of a stage: `diagramScene` throws on an id that names two things. */
export function uniqueGroups(pipeline: EffectPipeline): EffectGroup[] {
  const seen = new Set(pipeline.stages.map((s) => s.id));
  return (pipeline.groups ?? []).filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
}

/** The port called `id` among a stage's inputs and outputs, inputs first. */
export function portOn(stage: EffectStage | undefined, id: string): EffectPort | undefined {
  return [...(stage?.inputs ?? []), ...(stage?.outputs ?? [])].find((p) => p.id === id);
}

/** A stage's `kind` as the shipped looks read it: any value they do not know is `'stage'`. */
export function kindOf(stage: EffectStage): 'stage' | 'decision' | 'source' | 'sink' {
  return stage.kind === 'decision' || stage.kind === 'source' || stage.kind === 'sink' ? stage.kind : 'stage';
}

/** A wire with both ends present, and what a look needs to draw it. */
export interface DrawableWire {
  wire: EffectWire;
  /** Index into `pipeline.wires`. */
  index: number;
  /** The value type of the port the wire leaves. */
  type: string | undefined;
  /** `checkPipeline` reported it. */
  problem: boolean;
  fromStage: EffectStage;
  toStage: EffectStage;
}

/** The wires a look can draw: each one whose two stages and two ports exist,
 *  in the pipeline's order. A wire `checkPipeline` reported and that still has
 *  both ends is kept, with `problem` set. */
export function drawableWires(pipeline: EffectPipeline): DrawableWire[] {
  const stages = new Map(uniqueStages(pipeline).map((s) => [s.id, s]));
  const flagged = new Set(checkPipeline(pipeline).flatMap((p) => (p.wire === undefined ? [] : [p.wire])));
  return pipeline.wires.flatMap((wire, index) => {
    const fromStage = stages.get(wire.from.stage);
    const toStage = stages.get(wire.to.stage);
    const from = portOn(fromStage, wire.from.port);
    if (fromStage === undefined || toStage === undefined || from === undefined || portOn(toStage, wire.to.port) === undefined) return [];
    return [{ wire, index, type: from.type, problem: flagged.has(index), fromStage, toStage }];
  });
}

/** What a value row shows before a run fills it in. */
export const NO_VALUE = '–';
/** What a value row is measured as, so most values a run writes fit. */
const VALUE_ROOM = '00000.000';

/** The row id of the value row for an output, under its stage's body. */
export const valueRowId = (port: string): string => `value:${port}`;
/** The row id of the preview slot for an output, under its stage's body. */
export const previewRowId = (port: string): string => `preview:${port}`;

/** `RunRowOptions.previewSize`'s default: a 48-unit square. */
export const PREVIEW_SIZE = 48;

/** The rows a look keeps on each stage for what an `EffectRun` shows there.
 *  Kept from the start, so a run fills them in without the chart laying out
 *  again. A decision's symbol keeps neither. */
export interface RunRowOptions {
  /** A row per output for its value. Default false. */
  showValues?: boolean;
  /** A slot per output for its preview, after its value row. Default false. */
  showPreviews?: boolean;
  /** The preview slot's size: a square's side, or a width and height. A
   *  preview is stretched to fill it. Default `PREVIEW_SIZE`. */
  previewSize?: number | { width: number; height: number };
}

/** The `RunRowOptions` out of a look's options. */
function runRowsOf(o: RunRowOptions): RunRowOptions {
  return {
    ...(o.showValues !== undefined ? { showValues: o.showValues } : {}),
    ...(o.showPreviews !== undefined ? { showPreviews: o.showPreviews } : {}),
    ...(o.previewSize !== undefined ? { previewSize: o.previewSize } : {}),
  };
}

/** The body rows of an ordinary stage: its title, a row of its ports when
 *  `withPorts` (inputs left, outputs right), then for each output its value
 *  row when `showValues` and its preview slot when `showPreviews`, then its
 *  params when `showParams`. */
export function stageRows(
  stage: EffectStage,
  opts: { showParams: boolean; withPorts: boolean } & RunRowOptions,
): Row[] {
  const rows: Row[] = [{ kind: 'label', text: stage.title, style: { bold: true } }];
  const side = (ports: EffectStage['inputs']) => (ports ?? []).map((p) => ({ id: p.id, label: p.label ?? p.id, type: p.type }));
  if (opts.withPorts && ((stage.inputs?.length ?? 0) > 0 || (stage.outputs?.length ?? 0) > 0)) {
    rows.push({ kind: 'ports', left: side(stage.inputs), right: side(stage.outputs) });
  }
  const size = opts.previewSize ?? PREVIEW_SIZE;
  const preview = typeof size === 'number' ? { width: size, height: size } : size;
  // A repeated port id is a problem `checkPipeline` reports; one row for it.
  const seen = new Set<string>();
  for (const p of stage.outputs ?? []) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    if (opts.showValues === true) {
      rows.push({ kind: 'field', id: valueRowId(p.id), label: p.label ?? p.id, value: NO_VALUE, room: VALUE_ROOM });
    }
    if (opts.showPreviews === true) rows.push({ kind: 'slot', id: previewRowId(p.id), ...preview });
  }
  if (opts.showParams) for (const p of stage.params ?? []) rows.push({ kind: 'field', label: p.label, value: p.control ? formatParam(p.control) : p.value });
  return rows;
}

/** What a wire is called: its own label, or for a wire leaving a decision the
 *  exit's label, which defaults to the exit's id. Any other wire has no name. */
export function exitLabel(d: DrawableWire): string | undefined {
  if (d.wire.label !== undefined) return d.wire.label;
  return kindOf(d.fromStage) === 'decision' ? portOn(d.fromStage, d.wire.from.port)?.label ?? d.wire.from.port : undefined;
}

/** The node the shipped looks draw for a stage that is not a decision: a box,
 *  or a stadium for a source or a sink, holding `stageRows`. `ports` are its
 *  perimeter ports; pass none when the rows carry them. */
export function boxNode(
  stage: EffectStage,
  opts: { showParams: boolean; rowPorts: boolean; ports: readonly PortSpec[]; run?: RunRowOptions },
): DataNode {
  return {
    id: stage.id,
    outline: kindOf(stage) === 'stage' ? 'rect' : 'stadium',
    rows: stageRows(stage, { showParams: opts.showParams, withPorts: opts.rowPorts, ...runRowsOf(opts.run ?? {}) }),
    // Always set: left off, a stage port named n, e, s or w would share its id with a compass default.
    ports: opts.ports,
  };
}

/** One edge of a look's data, from port to port. */
export function wireEdge(
  from: EffectWire['from'],
  to: EffectWire['to'],
  label: string | undefined,
  id?: string,
): DataEdge {
  return {
    ...(id !== undefined ? { id } : {}),
    from: from.stage, fromPort: from.port, to: to.stage, toPort: to.port,
    ...(label !== undefined ? { label } : {}),
  };
}

/** One edge per drawable wire, from port to port, named by `exitLabel` and
 *  styled by `wireStyle` in its type's color. */
export function wireEdges(pipeline: EffectPipeline, color: TypeColor): { edge: DataEdge; style: EdgeStyle }[] {
  return drawableWires(pipeline).map((d) => ({
    edge: wireEdge(d.wire.from, d.wire.to, exitLabel(d), d.wire.id),
    style: wireStyle(color(d.type), isControl(pipeline, d.type), d.problem),
  }));
}

/** A look's `nodeStyle`, `edgeStyle`, and `theme`: `stageStyle` for each stage,
 *  and for each edge the style paired with it. */
export function sceneStyles(
  stages: readonly EffectStage[],
  edges: readonly { edge: DataEdge; style: EdgeStyle }[],
  theme: DiagramTheme = LOOK_THEME,
): Required<Pick<DiagramSceneOptions, 'nodeStyle' | 'edgeStyle' | 'theme'>> {
  const nodes = new Map(stages.map((s) => [s.id, stageStyle(s, theme)]));
  const wires = new Map(edges.map((e) => [edgeIdOf(e.edge), e.style]));
  return {
    theme,
    nodeStyle: (n) => nodes.get(n.id) ?? theme.roles[theme.defaultRole]!,
    edgeStyle: (e) => wires.get(edgeIdOf(e)) ?? wireStyle(UNTYPED, false, false),
  };
}
