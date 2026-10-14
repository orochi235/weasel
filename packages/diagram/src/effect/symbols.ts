/**
 * Branch symbols: the node a decision stage draws as. Each answers with the
 * outline, ports and marks of a diagram data node; a look adds the id and the
 * style. All of them read left to right: signal in on the left, exits on the right.
 */
import type { DataNode } from '../fromData';
import type { DataMark } from '../marks';
import type { PortAnchor, PortSpec } from '../types';
import { splitProblem } from './check';
import { isControl } from './draw';
import type { EffectPipeline, EffectPort, EffectStage } from './types';

export type BranchChoice = 'auto' | 'diamond' | 'bar' | 'demux' | 'switch';
export type BranchNode = Pick<DataNode, 'outline' | 'lines' | 'rows' | 'ports' | 'marks' | 'width' | 'height' | 'padding'>;
export type BranchSymbol = (stage: EffectStage, pipeline: EffectPipeline) => BranchNode;

type Side = 'left' | 'top' | 'right' | 'bottom';

/** The `i`th of `n` points spread evenly along one side of the box. */
function along(side: Side, i: number, n: number): PortAnchor {
  const t = (i + 1) / (n + 1);
  if (side === 'left') return { u: 0, v: t };
  if (side === 'right') return { u: 1, v: t };
  return side === 'top' ? { u: t, v: 0 } : { u: t, v: 1 };
}

const spread = (ports: readonly EffectPort[], side: Side): PortSpec[] =>
  ports.map((p, i) => ({ id: p.id, type: p.type, at: along(side, i, ports.length) }));

/** Inputs split into the signal (left) and what steers the branch (top). */
function inputs(stage: EffectStage, pipeline: EffectPipeline, steer?: string): PortSpec[] {
  const all = stage.inputs ?? [];
  const top = all.filter((p) => isControl(pipeline, p.type) || (p.id === steer && all.length > 1));
  return [...spread(all.filter((p) => !top.includes(p)), 'left'), ...spread(top, 'top')];
}

const title = (stage: EffectStage): DataMark =>
  ({ text: stage.title, at: { u: 0.5, v: 1 }, self: { u: 0.5, v: 0 }, offset: { x: 0, y: 4 } });

const diamond: BranchSymbol = (stage, pipeline) => {
  const exits = stage.outputs ?? [];
  const out: PortSpec[] = exits.length === 2
    ? [{ id: exits[0]!.id, type: exits[0]!.type, at: { u: 1, v: 0.5 } }, { id: exits[1]!.id, type: exits[1]!.type, at: { u: 0.5, v: 1 } }]
    : spread(exits, 'right');
  return { outline: 'diamond', lines: [stage.title], ports: [...inputs(stage, pipeline), ...out] };
};

const BAND_TINTS = ['#c58bff', '#6fb3ff', '#5ad07f', '#f2c14e'];

const bar: BranchSymbol = (stage, pipeline) => {
  const cuts = stage.split!.at;
  const exits = stage.outputs ?? [];
  const n = exits.length;
  const marks: DataMark[] = [];
  exits.forEach((_, i) => {
    const top = 1 - (i + 1) / n;
    marks.push({ d: `M0 ${top} H1 V${1 - i / n} H0 Z`, fill: BAND_TINTS[i % BAND_TINTS.length]!, opacity: 0.3 });
  });
  cuts.forEach((_, k) => marks.push({ d: `M-0.25 ${1 - (k + 1) / n} H1.25`, stroke: '#dbe7f2' }));
  cuts.forEach((cut, k) => marks.push({
    text: String(cut), at: { u: 0, v: 1 - (k + 1) / n }, self: { u: 1, v: 0.5 }, offset: { x: -10, y: 0 },
  }));
  marks.push(title(stage));
  return {
    outline: 'rect',
    lines: [],
    padding: 0,
    width: 24,
    height: Math.max(72, 30 * n),
    ports: [
      ...inputs(stage, pipeline, stage.split!.input),
      ...exits.map((p, i): PortSpec => ({ id: p.id, type: p.type, at: { u: 1, v: 1 - (i + 0.5) / n } })),
    ],
    marks,
  };
};

const demux: BranchSymbol = (stage, pipeline) => {
  const exits = stage.outputs ?? [];
  return {
    outline: 'trapezoid',
    lines: [],
    padding: 0,
    width: 44,
    height: Math.max(64, 28 * exits.length),
    ports: [...inputs(stage, pipeline), ...spread(exits, 'right')],
    marks: [title(stage)],
  };
};

/** A filled dot of radius `r` at (`cx`, `cy`), in the unit square. */
const dot = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;

const switchSymbol: BranchSymbol = (stage, pipeline) => {
  const exits = stage.outputs ?? [];
  return {
    outline: 'rect',
    lines: [],
    padding: 0,
    width: 48,
    height: 48,
    ports: [
      ...inputs(stage, pipeline),
      ...exits.map((p, i): PortSpec => ({ id: p.id, type: p.type, at: { u: 1, v: i === 0 ? 0.25 : 0.75 } })),
    ],
    marks: [
      { d: 'M0 0.5 H0.2 M0.8 0.25 H1 M0.8 0.75 H1', stroke: '#dbe7f2' },
      { d: 'M0.2 0.5 L0.78 0.27', stroke: '#dbe7f2', strokeWidth: 2.5 },
      { d: dot(0.2, 0.5, 0.07), fill: '#dbe7f2' },
      { d: dot(0.8, 0.25, 0.07), fill: '#dbe7f2' },
      { d: dot(0.8, 0.75, 0.07), stroke: '#dbe7f2' },
      title(stage),
    ],
  };
};

export const BRANCH_SYMBOLS: Readonly<Record<Exclude<BranchChoice, 'auto'>, BranchSymbol>> = Object.freeze({
  diamond,
  bar,
  demux,
  switch: switchSymbol,
});

/** The symbol `choice` comes to for `stage`: `bar` needs a sound split, `switch` two exits. */
export function symbolNameFor(stage: EffectStage, choice: BranchChoice = 'auto'): Exclude<BranchChoice, 'auto'> {
  const splits = stage.split !== undefined && splitProblem(stage) === null;
  const want = choice === 'auto' ? (splits ? 'bar' : 'diamond') : choice;
  if (want === 'bar' && !splits) return 'diamond';
  if (want === 'switch' && (stage.outputs ?? []).length !== 2) return 'diamond';
  return want;
}

export function branchNode(stage: EffectStage, pipeline: EffectPipeline, choice: BranchChoice = 'auto'): BranchNode {
  return BRANCH_SYMBOLS[symbolNameFor(stage, choice)](stage, pipeline);
}
