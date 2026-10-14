/** The node-graph look: every port a named row, a wire from port to port in
 *  the color of what it carries, flowing left to right. */
import type { Row } from '../body';
import { edgeIdOf, type DataEdge, type DataNode, type DiagramRouter, type EdgeStyle, type NodeStyle } from '../fromData';
import { checkPipeline } from './check';
import { isControl, kindOf, portOn, stageStyle, typeColors, uniqueGroups, uniqueStages, wireStyle, type EffectLook } from './draw';
import { branchNode, type BranchChoice } from './symbols';
import type { EffectPipeline, EffectStage, EffectWire } from './types';

export interface NodeGraphOptions {
  /** Default `'bezier'`. */
  router?: DiagramRouter;
  nodeGap?: number;
  rankGap?: number;
  /** A color per value type, over the palette's own. */
  colors?: Readonly<Record<string, string>>;
  /** Default true. */
  showParams?: boolean;
  /** Default `'auto'`. */
  branch?: BranchChoice;
}

/** A wire with both ends present, and what a look needs to draw it. */
export interface DrawableWire {
  wire: EffectWire;
  /** Index into `pipeline.wires`. */
  index: number;
  type: string | undefined;
  /** `checkPipeline` reported it. */
  problem: boolean;
  fromStage: EffectStage;
  toStage: EffectStage;
}

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

/** The rows of an ordinary stage: title, ports, params. */
export function stageRows(stage: EffectStage, showParams: boolean, withPorts: boolean): Row[] {
  const rows: Row[] = [{ kind: 'label', text: stage.title, style: { bold: true } }];
  const side = (ports: EffectStage['inputs']) => (ports ?? []).map((p) => ({ id: p.id, label: p.label ?? p.id, type: p.type }));
  if (withPorts && ((stage.inputs?.length ?? 0) > 0 || (stage.outputs?.length ?? 0) > 0)) {
    rows.push({ kind: 'ports', left: side(stage.inputs), right: side(stage.outputs) });
  }
  if (showParams) for (const p of stage.params ?? []) rows.push({ kind: 'field', label: p.label, value: p.value });
  return rows;
}

/** What a wire is called: its own label, or for a wire leaving a decision the
 *  exit's label, which defaults to the exit's id. */
export function exitLabel(d: DrawableWire): string | undefined {
  if (d.wire.label !== undefined) return d.wire.label;
  return kindOf(d.fromStage) === 'decision' ? portOn(d.fromStage, d.wire.from.port)?.label ?? d.wire.from.port : undefined;
}

export const nodeGraph: EffectLook<NodeGraphOptions> = (pipeline, options = {}) => {
  const color = typeColors(pipeline, options.colors);
  const stages = uniqueStages(pipeline);
  const styles = new Map<string, NodeStyle>(stages.map((s) => [s.id, stageStyle(s)]));

  const nodes = stages.map((stage): DataNode => {
    const kind = kindOf(stage);
    if (kind === 'decision') return { id: stage.id, ...branchNode(stage, pipeline, options.branch) };
    return {
      id: stage.id,
      outline: kind === 'stage' ? 'rect' : 'stadium',
      rows: stageRows(stage, options.showParams !== false, true),
      // Only the row ports: a compass default would share an id with a stage port named n, e, s or w.
      ports: [],
    };
  });

  const edgeStyles = new Map<string, EdgeStyle>();
  const edges = drawableWires(pipeline).map((d): DataEdge => {
    const label = exitLabel(d);
    const edge: DataEdge = {
      from: d.wire.from.stage, fromPort: d.wire.from.port,
      to: d.wire.to.stage, toPort: d.wire.to.port,
      ...(label !== undefined ? { label } : {}),
    };
    edgeStyles.set(edgeIdOf(edge), wireStyle(color(d.type), isControl(pipeline, d.type), d.problem));
    return edge;
  });

  return {
    data: { nodes, edges, groups: uniqueGroups(pipeline) },
    scene: {
      layout: 'layered',
      layoutOptions: {
        direction: 'right',
        ...(options.nodeGap !== undefined ? { nodeGap: options.nodeGap } : {}),
        ...(options.rankGap !== undefined ? { rankGap: options.rankGap } : {}),
      },
      router: options.router ?? 'bezier',
      nodeStyle: (n) => styles.get(n.id) ?? stageStyle({ id: n.id, title: '' }),
      edgeStyle: (e) => edgeStyles.get(edgeIdOf(e)) ?? wireStyle(color(undefined), false, false),
    },
    color,
  };
};
