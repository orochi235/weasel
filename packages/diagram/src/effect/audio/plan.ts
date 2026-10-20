import type { GraphTarget } from '@weasel-js/audio';
import { uniqueStages } from '../draw';
import { runOrder } from '../runner/order';
import { paramValues } from '../runner/params';
import type { EffectPipeline, EffectStage } from '../types';
import type { AudioSources, AudioStageNodes } from './nodes';

/** A node the plan builds: its stage type, its discrete settings and its numeric levels. */
export interface PlanNode {
  type: string;
  settings: Readonly<Record<string, unknown>>;
  levels: Readonly<Record<string, number>>;
}
/** A connection the plan makes, from a node to another node's port or to the graph's output. */
export interface PlanEdge { from: string; to: GraphTarget }

/** The graph an audio pipeline should play: what to build, how it connects, and which stages it left out. */
export interface LivePlan {
  nodes: Readonly<Record<string, PlanNode>>;
  /** Sorted by `edgeKey`, so equal plans compare equal. */
  edges: readonly PlanEdge[];
  /** Why a stage is not in `nodes`, by stage id. A stage left out for want of input has none. */
  errors: Readonly<Record<string, string>>;
}

/** The plan of a graph holding nothing. */
export const EMPTY_PLAN: LivePlan = { nodes: {}, edges: [], errors: {} };

const OUTPUT_TYPE = 'audio.output';

/** One string per edge, the same for equal edges. */
export const edgeKey = (e: PlanEdge): string =>
  JSON.stringify([e.from, 'output' in e.to ? null : [e.to.node, e.to.port]]);

function levelsOf(levels: readonly string[], params: Readonly<Record<string, unknown>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of levels) {
    const v = params[id];
    if (typeof v === 'number') out[id] = v;
  }
  return out;
}

/** Compiles the audio stages of `pipeline`; stages of other types are ignored. */
export function livePlan(pipeline: EffectPipeline, nodes: AudioStageNodes, sources: AudioSources): LivePlan {
  const stages = new Map<string, EffectStage>();
  for (const s of uniqueStages(pipeline)) {
    if (s.type !== undefined && (s.type in nodes || s.type === OUTPUT_TYPE)) stages.set(s.id, s);
  }
  const { order, cyclic } = runOrder(pipeline);
  const planNodes: Record<string, PlanNode> = {};
  const errors: Record<string, string> = {};
  for (const id of cyclic) if (stages.has(id)) errors[id] = 'on a feedback loop';

  /** The planned nodes whose sound leaves each stage: itself, or what a bypassed stage carries on. */
  const origins = new Map<string, readonly string[]>();
  const edges = new Map<string, PlanEdge>();

  for (const id of order) {
    const stage = stages.get(id);
    if (stage === undefined) continue;
    const isOutput = stage.type === OUTPUT_TYPE;
    const bypassed = stage.bypassed === true && !isOutput;
    const firstAudio = (stage.inputs ?? []).find((i) => i.type === 'audio')?.id;
    const fed = pipeline.wires
      .filter((w) => w.to.stage === id && stages.has(w.from.stage) && (!bypassed || w.to.port === firstAudio))
      .flatMap((w) => (origins.get(w.from.stage) ?? []).map((from) => ({ from, port: w.to.port })));
    if ((stage.inputs?.length ?? 0) > 0 && fed.length === 0) continue;

    if (bypassed) {
      origins.set(id, [...new Set(fed.map((f) => f.from))]);
      continue;
    }
    if (!isOutput) {
      const entry = nodes[stage.type!]!;
      const params = paramValues(stage);
      try {
        planNodes[id] = { type: stage.type!, settings: entry.settings(params, sources), levels: levelsOf(entry.levels, params) };
      } catch (err) {
        errors[id] = err instanceof Error ? err.message : String(err);
        continue;
      }
      origins.set(id, [id]);
    }
    for (const f of fed) {
      const edge: PlanEdge = { from: f.from, to: isOutput ? { output: true } : { node: id, port: f.port } };
      edges.set(edgeKey(edge), edge);
    }
  }
  return {
    nodes: planNodes,
    edges: [...edges.values()].sort((a, b) => {
      const [ka, kb] = [edgeKey(a), edgeKey(b)];
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    }),
    errors,
  };
}
