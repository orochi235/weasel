/** The main line as a sequence that can be reordered: which ports carry the
 *  signal between neighbors, and the rewiring that moves a stage along it. */
import { isNoopDrop, moveItems } from '@weasel-js/ui-logic';
import { drawableWires, isControl } from './draw';
import { canWire, nextWireId, pruneRoutes } from './edit';
import { mainChain } from './mainChain';
import type { EffectDoc, EffectPipeline, EffectPort, EffectWire } from './types';

/** How the stages of a chain are joined. */
export interface ChainLinks {
  /** By stage id: the input the main signal arrives on. */
  mainIn: ReadonlyMap<string, string>;
  /** By stage id: the output the main signal leaves by. */
  mainOut: ReadonlyMap<string, string>;
  /** By `k`: the index into `pipeline.wires` of the wire from `chain[k]` to
   *  `chain[k + 1]`, or `undefined` where no data wire joins them. */
  between: readonly (number | undefined)[];
}

/** The first data wire from each chain stage to the next, and the ports it joins. */
export function chainLinks(pipeline: EffectPipeline, chain: readonly string[]): ChainLinks {
  const at = new Map(chain.map((id, i) => [id, i]));
  const mainIn = new Map<string, string>();
  const mainOut = new Map<string, string>();
  const between: (number | undefined)[] = Array.from({ length: Math.max(0, chain.length - 1) }, () => undefined);
  for (const d of drawableWires(pipeline)) {
    if (isControl(pipeline, d.type)) continue;
    const a = at.get(d.wire.from.stage);
    if (a === undefined || at.get(d.wire.to.stage) !== a + 1 || between[a] !== undefined) continue;
    between[a] = d.index;
    mainOut.set(d.wire.from.stage, d.wire.from.port);
    mainIn.set(d.wire.to.stage, d.wire.to.port);
  }
  return { mainIn, mainOut, between };
}

type Ref = { stage: string; port: string };

const portsOf = (p: EffectPipeline, stage: string, side: 'inputs' | 'outputs'): readonly EffectPort[] =>
  p.stages.find((s) => s.id === stage)?.[side] ?? [];

/**
 * The doc with `stage`, which must be on `mainChain`, moved to gap `to` of
 * that chain: 0 before its first stage, `chain.length` after its last. Its
 * main input and output wires come off and its old neighbors are wired to
 * each other; the wire between its new neighbors comes off and it is wired
 * between them. Side wires, control wires, and params stay with it. `null`
 * where a new wire would join unlike types or a fed input, where `to` leaves
 * it where it is, or where the rewired pipeline's main line would not read
 * in the new order.
 */
export function moveInChain(doc: EffectDoc, stage: string, to: number): EffectDoc | null {
  return moveRunInChain(doc, stage, stage, to);
}

/**
 * `moveInChain` for the chain stages from `first` to `last`, which move as
 * one: the wires inside the run stay, and it is rewired at its ends. `null`
 * also where `last` comes before `first`, or `to` falls inside the run.
 */
export function moveRunInChain(doc: EffectDoc, first: string, last: string, to: number): EffectDoc | null {
  const p = doc.pipeline;
  const chain = mainChain(p);
  const i = chain.indexOf(first);
  const j = chain.indexOf(last);
  const run = Array.from({ length: j - i + 1 }, (_, k) => i + k);
  if (i < 0 || j < i || !Number.isInteger(to) || to < 0 || to > chain.length || isNoopDrop(run, to)) return null;
  const { mainIn, mainOut, between } = chainLinks(p, chain);
  const wIn = i > 0 ? between[i - 1] : undefined;
  const wOut = j < chain.length - 1 ? between[j] : undefined;
  const wAB = to > 0 && to < chain.length ? between[to - 1] : undefined;
  const gone = new Set([wIn, wOut, wAB].filter((k): k is number => k !== undefined));
  const kept = p.wires.filter((_, k) => !gone.has(k));
  const free = (ref: Ref) => !kept.some((w) => w.to.stage === ref.stage && w.to.port === ref.port);
  const pick = (id: string, side: 'inputs' | 'outputs', type?: string) =>
    portsOf(p, id, side).find((port) => (type === undefined || port.type === type) && (side === 'outputs' || free({ stage: id, port: port.id })))?.id;
  const typeOf = (id: string, port: string | undefined) => [...portsOf(p, id, 'inputs'), ...portsOf(p, id, 'outputs')].find((x) => x.id === port)?.type;

  const made: { reuse: number | undefined; from: Ref; to: Ref }[] = [];
  const prev = chain[i - 1];
  const next = chain[j + 1];
  if (prev !== undefined && next !== undefined) made.push({ reuse: wIn, from: p.wires[wIn!]!.from, to: p.wires[wOut!]!.to });
  const a = chain[to - 1];
  const b = chain[to];
  const sIn = mainIn.get(first) ?? pick(first, 'inputs');
  const sOut = mainOut.get(last) ?? pick(last, 'outputs');
  if (a !== undefined) {
    const aOut = wAB !== undefined ? p.wires[wAB]!.from.port : mainOut.get(a) ?? pick(a, 'outputs', typeOf(first, sIn));
    if (aOut === undefined || sIn === undefined) return null;
    made.push({ reuse: wAB, from: { stage: a, port: aOut }, to: { stage: first, port: sIn } });
  }
  if (b !== undefined) {
    const bIn = wAB !== undefined ? p.wires[wAB]!.to.port : mainIn.get(b) ?? pick(b, 'inputs', typeOf(last, sOut));
    if (bIn === undefined || sOut === undefined) return null;
    made.push({ reuse: wOut, from: { stage: last, port: sOut }, to: { stage: b, port: bIn } });
  }
  if (made.some((m) => !canWire(p, m.from, m.to) || !free(m.to))) return null;
  if (new Set(made.map((m) => `${m.to.stage}\u0000${m.to.port}`)).size !== made.length) return null;

  const wires: EffectWire[] = p.wires.flatMap((w, k) => {
    if (!gone.has(k)) return [w];
    const m = made.find((x) => x.reuse === k);
    return m === undefined ? [] : [{ ...w, from: m.from, to: m.to }];
  });
  for (const m of made) {
    if (m.reuse !== undefined) continue;
    wires.push({ id: nextWireId({ ...p, wires }), from: m.from, to: m.to });
  }
  const pipeline = { ...p, wires };
  const want = moveItems(chain, run, to);
  const got = mainChain(pipeline);
  if (got.length !== want.length || got.some((id, k) => id !== want[k])) return null;
  // A freed id may be minted again for a new wire, which must not inherit the old one's route.
  return pruneRoutes({ ...doc, pipeline }, [...gone].flatMap((k) => p.wires[k]!.id ?? []));
}

/** Whether `moveInChain` would make the move. */
export function canMoveInChain(doc: EffectDoc, stage: string, to: number): boolean {
  return moveInChain(doc, stage, to) !== null;
}
