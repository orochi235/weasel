/** Which stages a pipeline's main signal runs through, and which decisions on
 *  that run only choose between going on and skipping ahead. */
import { isControl, kindOf, uniqueStages } from './draw';
import { drawableWires, type DrawableWire } from './nodeGraph';
import type { EffectPipeline, EffectStage } from './types';

/** Stage ids of the longest path over data wires, sources first. */
export function mainChain(pipeline: EffectPipeline): string[] {
  const next = new Map<string, string[]>();
  for (const d of drawableWires(pipeline)) {
    if (isControl(pipeline, d.type)) continue;
    next.set(d.wire.from.stage, [...(next.get(d.wire.from.stage) ?? []), d.wire.to.stage]);
  }
  const best = new Map<string, string[]>();
  const walking = new Set<string>();
  const from = (id: string): string[] => {
    const known = best.get(id);
    if (known !== undefined) return known;
    // A stage already on the path closes a loop; the path stops there.
    if (walking.has(id)) return [];
    walking.add(id);
    let tail: string[] = [];
    for (const to of next.get(id) ?? []) {
      const path = from(to);
      if (path.length > tail.length && !path.includes(id)) tail = path;
    }
    walking.delete(id);
    const path = [id, ...tail];
    best.set(id, path);
    return path;
  };
  let longest: string[] = [];
  for (const stage of uniqueStages(pipeline)) {
    const path = from(stage.id);
    if (path.length > longest.length) longest = path;
  }
  return longest;
}

export interface Skip {
  decision: EffectStage;
  /** The wire into the decision, from the chain stage before it. */
  into: DrawableWire;
  /** The exit that goes on to the next chain stage. */
  through: DrawableWire;
  /** The exit that lands further along the chain. */
  skip: DrawableWire;
}

/** The decisions on `line` that only choose between going on and skipping ahead. */
export function skipDecisions(pipeline: EffectPipeline, line: readonly string[]): Skip[] {
  const wires = drawableWires(pipeline);
  const stages = new Map(uniqueStages(pipeline).map((s) => [s.id, s]));
  const out: Skip[] = [];
  line.forEach((id, i) => {
    const decision = stages.get(id);
    if (decision === undefined || kindOf(decision) !== 'decision' || i === 0) return;
    if ((decision.inputs ?? []).length !== 1 || (decision.outputs ?? []).length !== 2) return;
    const entering = wires.filter((d) => d.wire.to.stage === id);
    const leaving = wires.filter((d) => d.wire.from.stage === id);
    if (entering.length !== 1 || leaving.length !== 2 || entering[0]!.wire.from.stage !== line[i - 1]) return;
    const through = leaving.find((d) => d.wire.to.stage === line[i + 1]);
    const skip = leaving.find((d) => d !== through && line.indexOf(d.wire.to.stage) > i + 1);
    if (through !== undefined && skip !== undefined) out.push({ decision, into: entering[0]!, through, skip });
  });
  return out;
}
