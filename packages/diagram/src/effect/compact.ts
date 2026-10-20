import type { DataEdge, DataNode, DiagramRouter, EdgeStyle } from '../fromData';
import type { PortSpec } from '../types';
import {
  LOOK_THEME, boxNode, drawableWires, exitLabel, isControl, kindOf, sceneStyles, stageStyle, typeColors, uniqueGroups,
  uniqueStages, wireEdge, wireStyle, type DrawableWire, type EffectLook, type LookThemeOptions,
} from './draw';
import { branchNode, type BranchChoice } from './symbols';
import type { DiagramTheme } from '../theme/types';
import type { EffectPipeline, EffectStage } from './types';

/** Options for the `compact` look. */
export interface CompactOptions extends LookThemeOptions {
  /** Default `'bezier'`. */
  router?: DiagramRouter;
  /** Default 16. */
  nodeGap?: number;
  /** Default 48. */
  rankGap?: number;
  /** A color per value type, over the palette's own. */
  colors?: Readonly<Record<string, string>>;
  /** Default `'hexagon'`, the one symbol that keeps a decision one row tall. */
  branch?: BranchChoice;
}

/** Between a compact stage's outline and its title. */
export const COMPACT_PADDING = 4;

/** Every port at the middle of its side, inputs left and outputs right, with
 *  no type, so the port layer draws none of them. */
function sidePorts(stage: EffectStage): PortSpec[] {
  return [
    ...(stage.inputs ?? []).map((p) => ({ id: p.id, at: { u: 0, v: 0.5 } })),
    ...(stage.outputs ?? []).map((p) => ({ id: p.id, at: { u: 1, v: 0.5 } })),
  ];
}

const untyped = (ports: readonly PortSpec[] | undefined): PortSpec[] =>
  (ports ?? []).map(({ type: _type, ...port }) => port);

function nodeOf(stage: EffectStage, pipeline: EffectPipeline, branch: BranchChoice, theme: DiagramTheme): DataNode {
  if (kindOf(stage) !== 'decision') {
    return { ...boxNode(stage, { showParams: false, rowPorts: false, ports: sidePorts(stage) }), padding: COMPACT_PADDING };
  }
  const symbol = branchNode(stage, pipeline, branch, { style: stageStyle(stage, theme) });
  return { id: stage.id, ...symbol, ports: untyped(symbol.ports), padding: symbol.padding ?? COMPACT_PADDING };
}

/** The wires as lines: one per pair of stages, and for a decision one per
 *  exit, so a run can still fade the exits it did not take. */
function lines(pipeline: EffectPipeline): DrawableWire[][] {
  const by = new Map<string, DrawableWire[]>();
  for (const d of drawableWires(pipeline)) {
    const exit = kindOf(d.fromStage) === 'decision' ? d.wire.from.port : '';
    const key = JSON.stringify([d.wire.from.stage, exit, d.wire.to.stage]);
    by.set(key, [...(by.get(key) ?? []), d]);
  }
  return [...by.values()];
}

/** The compact look: each stage one line, its title alone, and no ports
 *  drawn; the wires between two stages one line between them. For a
 *  pipeline too big to read as a node graph. */
export const compact: EffectLook<CompactOptions> = (pipeline, options = {}) => {
  const theme = options.theme ?? LOOK_THEME;
  const color = typeColors(pipeline, options.colors, theme.series);
  const stages = uniqueStages(pipeline);
  const nodes = stages.map((stage) => nodeOf(stage, pipeline, options.branch ?? 'hexagon', theme));
  const edges = lines(pipeline).map((line): { edge: DataEdge; style: EdgeStyle } => {
    // Drawn as the data wire among them, if there is one.
    const first = line.find((d) => !isControl(pipeline, d.type)) ?? line[0]!;
    return {
      edge: wireEdge(first.wire.from, first.wire.to, exitLabel(first)),
      style: wireStyle(color(first.type), line.every((d) => isControl(pipeline, d.type)), line.some((d) => d.problem)),
    };
  });

  return {
    data: { nodes, edges: edges.map((e) => e.edge), groups: uniqueGroups(pipeline) },
    scene: {
      layout: 'layered',
      layoutOptions: { direction: 'right', nodeGap: options.nodeGap ?? 16, rankGap: options.rankGap ?? 48 },
      router: options.router ?? 'bezier',
      ...sceneStyles(stages, edges, theme),
    },
    color,
  };
};
