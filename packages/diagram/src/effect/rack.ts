import type { PortAnchor, PortSpec } from '../types';
import { edgeIdOf } from '../fromData';
import {
  LOOK_THEME, boxNode, drawableWires, exitLabel, isControl, kindOf, portOn, sceneStyles, stageStyle, typeColors,
  uniqueGroups, uniqueStages, wireEdge, wireStyle, type EffectLook, type LookThemeOptions, type RunRowOptions,
} from './draw';
import { chainLinks } from './chainEdit';
import { mainChain, skipDecisions, type Skip } from './mainChain';
import { branchNode, type BranchChoice } from './symbols';
import type { EffectPipeline, EffectPort, EffectStage } from './types';

/** Options for the `rack` look. */
export interface RackOptions extends RunRowOptions, LookThemeOptions {
  /** The stage ids on the line, in order. Default the longest path over data wires. */
  chain?: readonly string[];
  /** Which way the main signal runs: `'right'` (default) along a row, or
   *  `'down'` as a column, entering each stage at its top and leaving at its
   *  bottom. */
  direction?: 'right' | 'down';
  /** Where what feeds the chain from the side sits. Default `'below'`. Under
   *  `direction: 'down'`, `'below'` hangs it on the right of the column and
   *  `'above'` on the left. */
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
  id?: string;
  from: { stage: string; port: string };
  to: { stage: string; port: string };
  type: string | undefined;
  problem: boolean;
  label?: string;
  arc?: boolean;
  /** The exit of a collapsed decision this wire stands in for. */
  exit?: { stage: string; port: string };
}

/** The ports of the chain, and which of them carry the main signal. */
interface Line {
  at: ReadonlyMap<string, number>;
  mainIn: ReadonlyMap<string, string>;
  mainOut: ReadonlyMap<string, string>;
}

/** The least room between two ports on one edge of a stage, and from an end
 *  port to the box's corner. */
export const SIDE_PORT_GAP = 24;

/** A box's axes as the rack reads them: `along` the line, from where the
 *  main signal enters to where it leaves, and `across` it, from 0 to 1. */
interface Frame {
  anchor: (along: number, across: number) => PortAnchor;
  along: (at: PortAnchor) => number;
  across: (at: PortAnchor) => number;
  normal: (across: number) => { x: number; y: number };
}

const ROW: Frame = {
  anchor: (along, across) => ({ u: along, v: across }),
  along: (at) => at.u,
  across: (at) => at.v,
  normal: (across) => ({ x: 0, y: across * 2 - 1 }),
};

const COLUMN: Frame = {
  anchor: (along, across) => ({ u: across, v: along }),
  along: (at) => at.v,
  across: (at) => at.u,
  normal: (across) => ({ x: across * 2 - 1, y: 0 }),
};

/** Ports spread along the edge at `across`, each facing straight out of it
 *  rather than away from the box's center, so a wire leaves square to the edge. */
const spreadAt = (frame: Frame, ports: readonly EffectPort[], across: number): PortSpec[] =>
  ports.map((p, i) => ({ id: p.id, type: p.type, at: frame.anchor((i + 1) / (ports.length + 1), across), normal: frame.normal(across) }));

/** The least extent along the line a box may have so the ports on each edge
 *  parallel to it sit `SIDE_PORT_GAP` apart. */
function roomFor(frame: Frame, ports: readonly PortSpec[]): number {
  const count = (across: number) => ports.filter((p) => {
    const along = frame.along(p.at);
    return frame.across(p.at) === across && along > 0 && along < 1;
  }).length;
  return (Math.max(count(0), count(1)) + 1) * SIDE_PORT_GAP;
}

function rackWires(pipeline: EffectPipeline, skips: readonly Skip[]): RackWire[] {
  const eaten = new Set<number>(skips.flatMap((s) => [s.into.index, s.through.index, s.skip.index]));
  const wires: RackWire[] = drawableWires(pipeline).filter((d) => !eaten.has(d.index)).map((d) => {
    const label = exitLabel(d);
    return {
      ...(d.wire.id !== undefined ? { id: d.wire.id } : {}),
      from: d.wire.from, to: d.wire.to, type: d.type, problem: d.problem, ...(label !== undefined ? { label } : {}),
    };
  });
  for (const s of skips) {
    wires.push({
      from: s.into.wire.from, to: s.through.wire.to, type: s.into.type, problem: s.into.problem || s.through.problem,
      exit: { stage: s.decision.id, port: s.through.wire.from.port },
    });
    wires.push({
      from: { stage: s.into.wire.from.stage, port: SKIP_OUT },
      to: { stage: s.skip.wire.to.stage, port: SKIP_IN },
      type: s.into.type,
      problem: s.into.problem || s.skip.problem,
      label: `${s.decision.title}: ${exitLabel(s.skip)!}`,
      arc: true,
      exit: { stage: s.decision.id, port: s.skip.wire.from.port },
    });
  }
  return wires;
}

function lineOf(pipeline: EffectPipeline, ordered: readonly string[], chain: readonly string[]): Line {
  const { mainIn, mainOut } = chainLinks(pipeline, ordered);
  return { at: new Map(chain.map((id, i) => [id, i])), mainIn, mainOut };
}

/** `near` and `far` are where across the box the edge facing the side stages
 *  and the one facing away sit. */
function portsOf(stage: EffectStage, line: Line, wires: readonly RackWire[], frame: Frame, near: number, far: number): PortSpec[] {
  if (!line.at.has(stage.id)) return [...spreadAt(frame, stage.outputs ?? [], far), ...spreadAt(frame, stage.inputs ?? [], near)];
  const typed = (p: EffectPort, anchor: PortAnchor): PortSpec => ({ id: p.id, type: p.type, at: anchor });
  const out: PortSpec[] = [];
  const side: EffectPort[] = [];
  for (const p of stage.inputs ?? []) {
    if (p.id === line.mainIn.get(stage.id)) out.push(typed(p, frame.anchor(0, 0.5)));
    else side.push(p);
  }
  for (const p of stage.outputs ?? []) {
    if (p.id === line.mainOut.get(stage.id)) out.push(typed(p, frame.anchor(1, 0.5)));
    else side.push(p);
  }
  out.push(...spreadAt(frame, side, near));
  const type = portOn(stage, line.mainOut.get(stage.id) ?? line.mainIn.get(stage.id) ?? '')?.type;
  const arc = (id: string, along: number): PortSpec => ({ id, at: frame.anchor(along, far), ...(type !== undefined ? { type } : {}) });
  if (wires.some((w) => w.arc && w.from.stage === stage.id)) out.push(arc(SKIP_OUT, 0.75));
  if (wires.some((w) => w.arc && w.to.stage === stage.id)) out.push(arc(SKIP_IN, 0.25));
  return out;
}

/** The rack look: the main signal on one straight line with its stages in
 *  order, and whatever feeds a stage from the side hung beside it. */
export const rack: EffectLook<RackOptions> = (pipeline, options = {}) => {
  const theme = options.theme ?? LOOK_THEME;
  const color = typeColors(pipeline, options.colors, theme.series);
  const down = options.direction === 'down';
  const frame = down ? COLUMN : ROW;
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
  const line = lineOf(pipeline, ordered, chain);

  const kept = stages.filter((s) => !gone.has(s.id));
  const controlSide = below ? 'bottom' : 'top';
  const nodes = kept.map((stage) => {
    if (kindOf(stage) === 'decision') return { id: stage.id, ...branchNode(stage, pipeline, options.branch, { controlSide, style: stageStyle(stage, theme) }) };
    const ports = portsOf(stage, line, wires, frame, near, far);
    const node = boxNode(stage, { showParams: options.showParams !== false, rowPorts: false, ports, run: options });
    const room = roomFor(frame, ports);
    // One port per edge fits the box diagramScene sizes anyway; leave that in charge.
    if (room <= 2 * SIDE_PORT_GAP) return node;
    return down ? { ...node, height: Math.max(node.height ?? 0, room) } : { ...node, width: room };
  });

  const byId = new Map(kept.map((s) => [s.id, s]));
  const edges = wires.map((wire) => {
    const to = byId.get(wire.to.stage);
    const sideInput = to !== undefined && kindOf(to) !== 'decision' && !wire.arc
      && wire.to.port !== line.mainIn.get(wire.to.stage) && line.at.has(wire.to.stage);
    const label = wire.label ?? (sideInput ? portOn(to, wire.to.port)?.label ?? wire.to.port : undefined);
    return {
      edge: wireEdge(wire.from, wire.to, label, wire.id),
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
        direction: down ? 'down' : 'right',
        chain,
        chainSide: below ? 'after' : 'before',
        ...(options.nodeGap !== undefined ? { nodeGap: options.nodeGap } : {}),
        ...(options.rankGap !== undefined ? { rankGap: options.rankGap } : {}),
      },
      router: 'bezier',
      ...sceneStyles(kept, edges, theme),
    },
    color,
    order: { axis: down ? 'y' : 'x', items: chain.map((id) => ({ id })) },
    exits: new Map(wires.flatMap((wire, i) => (wire.exit === undefined ? [] : [[edgeIdOf(edges[i]!.edge), wire.exit]]))),
  };
};
