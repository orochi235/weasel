/** Which stages a pipeline's main signal runs through, and which decisions on
 *  that run only choose between going on and skipping ahead. */
import { drawableWires, isControl, kindOf, uniqueStages, type DrawableWire } from './draw';
import type { EffectPipeline, EffectStage } from './types';

/** How many stages `mainChain` walks before it stops looking past a loop. */
const WALK_BUDGET = 20_000;

/** Stage ids of the longest path over data wires, sources first. */
export function mainChain(pipeline: EffectPipeline): string[] {
  const next = new Map<string, string[]>();
  for (const d of drawableWires(pipeline)) {
    if (isControl(pipeline, d.type)) continue;
    next.set(d.wire.from.stage, [...(next.get(d.wire.from.stage) ?? []), d.wire.to.stage]);
  }
  // A path from a stage that met no stage on the walk holds for any walk, so
  // it is kept; one cut short by a loop depends on the walk and is found again
  // from each, until `budget` stages have been walked, after which every path
  // is kept, so a dense loop answers a long path rather than the longest.
  const best = new Map<string, string[]>();
  const walking = new Set<string>();
  let budget = WALK_BUDGET;
  const from = (id: string): { path: string[]; cut: boolean } => {
    const known = best.get(id);
    if (known !== undefined) return { path: known, cut: false };
    // A stage already on the path closes a loop; the path stops there.
    if (walking.has(id)) return { path: [], cut: true };
    budget--;
    walking.add(id);
    let tail: string[] = [];
    let cut = false;
    for (const to of next.get(id) ?? []) {
      const step = from(to);
      cut ||= step.cut;
      if (step.path.length > tail.length && !step.path.includes(id)) tail = step.path;
    }
    walking.delete(id);
    const path = [id, ...tail];
    if (!cut || budget <= 0) best.set(id, path);
    return { path, cut };
  };
  let longest: string[] = [];
  for (const stage of uniqueStages(pipeline)) {
    const { path } = from(stage.id);
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

/** The decisions on `line` that only choose between going on and skipping ahead,
 *  and sit between ordinary stages: one next to another decision stays a symbol. */
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
    const ordinary = (s: EffectStage | undefined) => s !== undefined && kindOf(s) !== 'decision';
    if (!ordinary(stages.get(line[i - 1]!)) || !ordinary(through?.toStage) || !ordinary(skip?.toStage)) return;
    if (through !== undefined && skip !== undefined) out.push({ decision, into: entering[0]!, through, skip });
  });
  return out;
}
