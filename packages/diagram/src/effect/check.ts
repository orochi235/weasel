import type { EffectCluster, EffectPipeline, EffectStage } from './types';

/** One thing wrong with a pipeline, and where. */
export interface EffectProblem {
  kind: 'missing-stage' | 'missing-port' | 'wrong-direction' | 'type-mismatch'
    | 'duplicate-stage' | 'duplicate-port' | 'duplicate-cluster' | 'missing-member' | 'cluster-loop' | 'bad-split';
  message: string;
  stage?: string;
  port?: string;
  /** Index into `pipeline.wires`. */
  wire?: number;
  cluster?: string;
  /** Every cluster in a `cluster-loop`, in pipeline order; `cluster` is the first. */
  clusters?: string[];
}

/** What `split` gets wrong on `stage`, or null. */
export function splitProblem(stage: EffectStage): string | null {
  const split = stage.split;
  if (split === undefined) return null;
  if (!(stage.inputs ?? []).some((p) => p.id === split.input)) return `splits on "${split.input}", which is not one of its inputs`;
  if (split.at.length === 0) return 'splits with no cuts';
  if (!split.at.every(Number.isFinite)) return 'has a cut that is not a finite number';
  if (split.at.some((cut, i) => i > 0 && cut <= split.at[i - 1]!)) return 'has cuts that are not in ascending order';
  const exits = (stage.outputs ?? []).length;
  if (exits !== split.at.length + 1) return `has ${split.at.length} cuts and ${exits} outputs; it needs ${split.at.length + 1}`;
  return null;
}

/** Everything wrong with `pipeline`. Never throws. */
export function checkPipeline(pipeline: EffectPipeline): EffectProblem[] {
  const out: EffectProblem[] = [];
  const stages = new Map<string, EffectStage>();
  for (const stage of pipeline.stages) {
    if (stages.has(stage.id)) {
      out.push({ kind: 'duplicate-stage', stage: stage.id, message: `Stage "${stage.id}" appears more than once.` });
      continue;
    }
    stages.set(stage.id, stage);
    const seen = new Set<string>();
    for (const port of [...(stage.inputs ?? []), ...(stage.outputs ?? [])]) {
      if (seen.has(port.id)) {
        out.push({ kind: 'duplicate-port', stage: stage.id, port: port.id, message: `Stage "${stage.id}" has two ports called "${port.id}".` });
      }
      seen.add(port.id);
    }
    const split = splitProblem(stage);
    if (split !== null) out.push({ kind: 'bad-split', stage: stage.id, message: `Stage "${stage.id}" ${split}.` });
  }

  pipeline.wires.forEach((wire, index) => {
    const ends = ([['from', 'outputs', 'inputs'], ['to', 'inputs', 'outputs']] as const).map(([end, own, other]) => {
      const ref = wire[end];
      const stage = stages.get(ref.stage);
      if (stage === undefined) {
        out.push({ kind: 'missing-stage', wire: index, stage: ref.stage, message: `Wire ${index} names stage "${ref.stage}", which does not exist.` });
        return null;
      }
      const port = (stage[own] ?? []).find((p) => p.id === ref.port);
      if (port !== undefined) return port;
      const wrong = (stage[other] ?? []).some((p) => p.id === ref.port);
      out.push(wrong
        ? { kind: 'wrong-direction', wire: index, stage: ref.stage, port: ref.port, message: `Wire ${index} ${end === 'from' ? 'starts at an input' : 'ends at an output'}, "${ref.stage}.${ref.port}".` }
        : { kind: 'missing-port', wire: index, stage: ref.stage, port: ref.port, message: `Wire ${index} names port "${ref.stage}.${ref.port}", which does not exist.` });
      return null;
    });
    const [from, to] = ends;
    if (from && to && from.type !== to.type) {
      out.push({ kind: 'type-mismatch', wire: index, message: `Wire ${index} joins a "${from.type}" output to a "${to.type}" input.` });
    }
  });

  const clusterIds = new Set<string>();
  const clusters = (pipeline.clusters ?? []).filter((cluster) => {
    const repeat = clusterIds.has(cluster.id);
    if (repeat || stages.has(cluster.id)) {
      out.push({
        kind: 'duplicate-cluster',
        cluster: cluster.id,
        message: repeat ? `Group "${cluster.id}" appears more than once.` : `Group "${cluster.id}" has the id of a stage.`,
      });
      return false;
    }
    clusterIds.add(cluster.id);
    return true;
  });
  for (const cluster of clusters) {
    for (const member of cluster.members) {
      if (stages.has(member) || clusterIds.has(member)) continue;
      out.push({ kind: 'missing-member', cluster: cluster.id, message: `Group "${cluster.id}" names "${member}", which is neither a stage nor a group.` });
    }
  }
  out.push(...clusterLoops(clusters));
  return out;
}

/** One `cluster-loop` per set of clusters that hold each other, directly or through other clusters. */
function clusterLoops(clusters: readonly EffectCluster[]): EffectProblem[] {
  const inner = new Map(clusters.map((g) => [g.id, g.members]));
  const reach = new Map(clusters.map((g) => {
    const seen = new Set<string>();
    const todo = [...g.members];
    for (let id = todo.pop(); id !== undefined; id = todo.pop()) {
      const members = inner.get(id);
      if (members === undefined || seen.has(id)) continue;
      seen.add(id);
      todo.push(...members);
    }
    return [g.id, seen];
  }));
  const reported = new Set<string>();
  const out: EffectProblem[] = [];
  for (const g of clusters) {
    if (reported.has(g.id) || !reach.get(g.id)!.has(g.id)) continue;
    const loop = clusters.filter((h) => reach.get(g.id)!.has(h.id) && reach.get(h.id)!.has(g.id)).map((h) => h.id);
    for (const id of loop) reported.add(id);
    const named = loop.map((id) => `"${id}"`);
    const message = loop.length === 1
      ? `Group ${named[0]} holds itself.`
      : `Groups ${named.length === 2 ? named.join(' and ') : `${named.slice(0, -1).join(', ')}, and ${named.at(-1)}`} hold each other in a loop.`;
    out.push({ kind: 'cluster-loop', cluster: loop[0]!, clusters: loop, message });
  }
  return out;
}
