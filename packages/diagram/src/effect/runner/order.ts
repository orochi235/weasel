import { uniqueStages } from '../draw';
import type { EffectPipeline } from '../types';

/** The order a run evaluates stages in, and the stages it never can. */
export interface RunOrder {
  /** Every stage outside a cycle, each after every stage that feeds it. */
  order: string[];
  /** The stages on a cycle of wires, in stage order. */
  cyclic: string[];
}

/** The stages topologically over data and control wires alike, stable by
 *  stage order: of the stages ready to go, the earliest goes first. A stage on
 *  a cycle is left out, and so are its wires. */
export function runOrder(pipeline: EffectPipeline): RunOrder {
  const ids = uniqueStages(pipeline).map((s) => s.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const next = ids.map(() => [] as number[]);
  for (const w of pipeline.wires) {
    const a = index.get(w.from.stage);
    const b = index.get(w.to.stage);
    if (a !== undefined && b !== undefined) next[a]!.push(b);
  }
  const onCycle = cycleMembers(next);

  const waiting = ids.map(() => 0);
  for (let a = 0; a < ids.length; a++) {
    if (!onCycle[a]) for (const b of next[a]!) if (!onCycle[b]) waiting[b]!++;
  }
  const ready = new Set(ids.flatMap((_, i) => (!onCycle[i] && waiting[i] === 0 ? [i] : [])));
  const order: string[] = [];
  while (ready.size > 0) {
    const i = Math.min(...ready);
    ready.delete(i);
    order.push(ids[i]!);
    for (const b of next[i]!) if (!onCycle[b] && --waiting[b]! === 0) ready.add(b);
  }
  return { order, cyclic: ids.filter((_, i) => onCycle[i]) };
}

/** Whether each vertex is on a cycle: in a strongly connected component of
 *  more than one vertex, or wired to itself. Tarjan's algorithm. */
function cycleMembers(next: readonly (readonly number[])[]): boolean[] {
  const n = next.length;
  const low = new Array<number>(n).fill(-1);
  const seen = new Array<number>(n).fill(-1);
  const onStack = new Array<boolean>(n).fill(false);
  const result = new Array<boolean>(n).fill(false);
  const stack: number[] = [];
  let counter = 0;
  const visit = (v: number): void => {
    seen[v] = low[v] = counter++;
    stack.push(v);
    onStack[v] = true;
    for (const w of next[v]!) {
      if (seen[w] === -1) {
        visit(w);
        low[v] = Math.min(low[v]!, low[w]!);
      } else if (onStack[w]) {
        low[v] = Math.min(low[v]!, seen[w]!);
      }
    }
    if (low[v] !== seen[v]) return;
    const component: number[] = [];
    let w: number;
    do {
      w = stack.pop()!;
      onStack[w] = false;
      component.push(w);
    } while (w !== v);
    if (component.length > 1 || next[v]!.includes(v)) for (const c of component) result[c] = true;
  };
  for (let v = 0; v < n; v++) if (seen[v] === -1) visit(v);
  return result;
}
