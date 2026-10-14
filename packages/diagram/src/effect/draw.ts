/** What every look shares: how a type is colored, how a stage and a wire are
 *  styled, and the lookups a look does over a pipeline. */
import type { DiagramData, DiagramSceneOptions, EdgeStyle, NodeStyle } from '../fromData';
import type { EffectGroup, EffectPipeline, EffectPort, EffectStage } from './types';

export type TypeColor = (type: string | undefined) => string;

/** What a look hands back: `diagramScene`'s two arguments, and its colors. */
export interface EffectLookResult {
  data: DiagramData;
  scene: DiagramSceneOptions;
  color: TypeColor;
}

/** One way of drawing a pipeline. */
export type EffectLook<TOptions = unknown> = (pipeline: EffectPipeline, options?: TOptions) => EffectLookResult;

const PALETTE = ['#6fb3ff', '#c58bff', '#f2c14e', '#5ad07f', '#ff8a6b', '#4fd1c5', '#e58fb8', '#b0bec5'];
const UNTYPED = '#8aa2b5';
export const PROBLEM_COLOR = '#ff5d5d';

const NORMAL: NodeStyle = { fill: '#16222c', stroke: '#3d566b', text: '#dbe7f2', strokeWidth: 1.5 };
const BYPASSED: NodeStyle = { fill: '#121a21', stroke: '#3d566b', text: '#6d8496', strokeWidth: 1.5, dash: [4, 3] };

/** A color per type: the one given, or the next in the palette in the order
 *  types first appear on the pipeline's ports. */
export function typeColors(pipeline: EffectPipeline, given: Readonly<Record<string, string>> = {}): TypeColor {
  const colors = new Map<string, string>();
  for (const stage of pipeline.stages) {
    for (const port of [...(stage.inputs ?? []), ...(stage.outputs ?? [])]) {
      if (colors.has(port.type)) continue;
      colors.set(port.type, given[port.type] ?? PALETTE[colors.size % PALETTE.length]!);
    }
  }
  return (type) => (type === undefined ? UNTYPED : colors.get(type) ?? given[type] ?? UNTYPED);
}

export function isControl(pipeline: EffectPipeline, type: string | undefined): boolean {
  return type !== undefined && pipeline.types?.[type]?.control === true;
}

export function stageStyle(stage: EffectStage): NodeStyle {
  return stage.bypassed === true ? BYPASSED : NORMAL;
}

export function wireStyle(color: string, control: boolean, problem: boolean): EdgeStyle {
  return {
    stroke: problem ? PROBLEM_COLOR : color,
    width: 2,
    markerEnd: null,
    ...(control ? { dash: [5, 4] } : {}),
  };
}

/** Stages with the repeats dropped, first one kept. */
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

export function portOn(stage: EffectStage | undefined, id: string): EffectPort | undefined {
  return [...(stage?.inputs ?? []), ...(stage?.outputs ?? [])].find((p) => p.id === id);
}

export function kindOf(stage: EffectStage): 'stage' | 'decision' | 'source' | 'sink' {
  return stage.kind === 'decision' || stage.kind === 'source' || stage.kind === 'sink' ? stage.kind : 'stage';
}
