import type { PortAnchor, PortSpec } from '../types';
import {
  boxNode, drawableWires, exitLabel, isControl, kindOf, portOn, sceneStyles, typeColors, uniqueGroups, uniqueStages,
  wireEdge, wireStyle, type EffectLook,
} from './draw';
import { mainChain, skipDecisions, type Skip } from './mainChain';
import { branchNode, type BranchChoice } from './symbols';
import type { EffectPipeline, EffectPort, EffectStage } from './types';

/** Options for the `rack` look. */
export interface RackOptions {
  /** The stage ids on the line, in order. Default the longest path over data wires. */
  chain?: readonly string[];
  /** Where what feeds the chain from the side sits. Default `'below'`. */
  side?: 'below' | 'above';
  nodeGap?: number;
  rankGap?: number;
  /** A color per value type, over the palette's own. */
  colors?: Readonly<Record<string, string>>;
  /** Whether a stage lists its `params`. Default true. A decision's symbol
   *  does not show params either way. */
  showParams?: boolean;
  /** Default `'auto'`. */
  branch?: BranchChoice;
  /** Draw a decision that only skips ahead as an arc over what it skips. Default true. */
  collapseSkips?: boolean;
}

const SKIP_OUT = '~skip-out';
const SKIP_IN = '~skip-in';

/** One wire the rack draws: a pipeline wire, or one made by collapsing a decision. */
interface RackWire {
  from: { stage: string; port: string };
  to: { stage: string; port: string };
  type: string | undefined;
  problem: boolean;
  label?: string;
  arc?: boolean;
}

/** The ports of the chain, and which of them carry the main signal. */
interface Line {
  at: ReadonlyMap<string, number>;
  mainIn: ReadonlyMap<string, string>;
  mainOut: ReadonlyMap<string, string>;
}

const spreadAt = (ports: readonly EffectPort[], v: number): PortSpec[] =>
  ports.map((p, i) => ({ id: p.id, type: p.type, at: { u: (i + 1) / (ports.length + 1), v } }));

function rackWires(pipeline: EffectPipeline, skips: readonly Skip[]): RackWire[] {
  const eaten = new Set<number>(skips.flatMap((s) => [s.into.index, s.through.index, s.skip.index]));
  const wires: RackWire[] = drawableWires(pipeline).filter((d) => !eaten.has(d.index)).map((d) => {
    const label = exitLabel(d);
    return { from: d.wire.from, to: d.wire.to, type: d.type, problem: d.problem, ...(label !== undefined ? { label } : {}) };
  });
  for (const s of skips) {
    wires.push({ from: s.into.wire.from, to: s.through.wire.to, type: s.into.type, problem: s.into.problem || s.through.problem });
    wires.push({
      from: { stage: s.into.wire.from.stage, port: SKIP_OUT },
      to: { stage: s.skip.wire.to.stage, port: SKIP_IN },
      type: s.into.type,
      problem: s.into.problem || s.skip.problem,
      label: `${s.decision.title}: ${exitLabel(s.skip)!}`,
      arc: true,
    });
  }
  return wires;
}

function lineOf(pipeline: EffectPipeline, chain: readonly string[], wires: readonly RackWire[]): Line {
  const at = new Map(chain.map((id, i) => [id, i]));
  const mainIn = new Map<string, string>();
  const mainOut = new Map<string, string>();
  for (const wire of wires) {
    if (wire.arc || isControl(pipeline, wire.type)) continue;
    const a = at.get(wire.from.stage);
    const b = at.get(wire.to.stage);
    if (a === undefined || b !== a + 1) continue;
    if (!mainOut.has(wire.from.stage)) mainOut.set(wire.from.stage, wire.from.port);
    if (!mainIn.has(wire.to.stage)) mainIn.set(wire.to.stage, wire.to.port);
  }
  return { at, mainIn, mainOut };
}

/** `near` and `far` are the `v` of the edge facing the side stages and the one facing away. */
function portsOf(stage: EffectStage, line: Line, wires: readonly RackWire[], near: number, far: number): PortSpec[] {
  if (!line.at.has(stage.id)) return [...spreadAt(stage.outputs ?? [], far), ...spreadAt(stage.inputs ?? [], near)];
  const typed = (p: EffectPort, anchor: PortAnchor): PortSpec => ({ id: p.id, type: p.type, at: anchor });
  const out: PortSpec[] = [];
  const side: EffectPort[] = [];
  for (const p of stage.inputs ?? []) {
    if (p.id === line.mainIn.get(stage.id)) out.push(typed(p, { u: 0, v: 0.5 }));
    else side.push(p);
  }
  for (const p of stage.outputs ?? []) {
    if (p.id === line.mainOut.get(stage.id)) out.push(typed(p, { u: 1, v: 0.5 }));
    else side.push(p);
  }
  out.push(...spreadAt(side, near));
  const type = portOn(stage, line.mainOut.get(stage.id) ?? line.mainIn.get(stage.id) ?? '')?.type;
  const arc = (id: string, u: number): PortSpec => ({ id, at: { u, v: far }, ...(type !== undefined ? { type } : {}) });
  if (wires.some((w) => w.arc && w.from.stage === stage.id)) out.push(arc(SKIP_OUT, 0.75));
  if (wires.some((w) => w.arc && w.to.stage === stage.id)) out.push(arc(SKIP_IN, 0.25));
  return out;
}

/** The rack look: the main signal on one straight line with its stages in
 *  order, and whatever feeds a stage from the side hung beside it. */
export const rack: EffectLook<RackOptions> = (pipeline, options = {}) => {
  const color = typeColors(pipeline, options.colors);
  const below = options.side !== 'above';
  const near = below ? 1 : 0;
  const far = below ? 0 : 1;
  const stages = uniqueStages(pipeline);
  const given = options.chain?.filter((id) => stages.some((s) => s.id === id));
  const ordered = given !== undefined && given.length > 0 ? given : mainChain(pipeline);
  const skips = options.collapseSkips === false ? [] : skipDecisions(pipeline, ordered);
  const gone = new Set(skips.map((s) => s.decision.id));
  const chain = ordered.filter((id) => !gone.has(id));
  const wires = rackWires(pipeline, skips);
  const line = lineOf(pipeline, chain, wires);

  const kept = stages.filter((s) => !gone.has(s.id));
  const nodes = kept.map((stage) => (kindOf(stage) === 'decision'
    ? { id: stage.id, ...branchNode(stage, pipeline, options.branch) }
    : boxNode(stage, { showParams: options.showParams !== false, rowPorts: false, ports: portsOf(stage, line, wires, near, far) })));

  const byId = new Map(kept.map((s) => [s.id, s]));
  const edges = wires.map((wire) => {
    const to = byId.get(wire.to.stage);
    const sideInput = to !== undefined && kindOf(to) !== 'decision' && !wire.arc
      && wire.to.port !== line.mainIn.get(wire.to.stage) && line.at.has(wire.to.stage);
    const label = wire.label ?? (sideInput ? portOn(to, wire.to.port)?.label ?? wire.to.port : undefined);
    return {
      edge: wireEdge(wire.from, wire.to, label),
      style: wireStyle(color(wire.type), wire.arc === true || isControl(pipeline, wire.type), wire.problem),
    };
  });

  return {
    data: {
      nodes,
      edges: edges.map((e) => e.edge),
      groups: uniqueGroups(pipeline).map((g) => ({ ...g, members: g.members.filter((m) => !gone.has(m)) })),
    },
    scene: {
      layout: 'chain',
      layoutOptions: {
        direction: 'right',
        chain,
        chainSide: below ? 'after' : 'before',
        ...(options.nodeGap !== undefined ? { nodeGap: options.nodeGap } : {}),
        ...(options.rankGap !== undefined ? { rankGap: options.rankGap } : {}),
      },
      router: 'bezier',
      ...sceneStyles(kept, edges),
    },
    color,
  };
};
