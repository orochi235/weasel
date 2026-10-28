/**
 * Branch symbols: the node a decision stage draws as. Each answers with the
 * outline, ports and marks of a diagram data node; a look adds the id and the
 * style. All of them read left to right, signal in on the left and exits on
 * the right, or top to bottom under `direction: 'down'`.
 */
import type { DataMark } from '../marks';
import type { PortSpec } from '../types';
import { comparator, crossover, fork, hexagon, step } from './glyphs';
import { flowing, transposeD } from './symbolFlow';
import {
  bandExits, canBand, cutLabels, diamond, dot, inputs, spread, styleOf, tintsOf, title, twoExits,
  type BranchNode, type BranchOptions, type BranchSymbol,
} from './symbolParts';
import type { EffectPipeline, EffectStage } from './types';

export type { BranchNode, BranchOptions, BranchSymbol } from './symbolParts';

/** Which symbol a decision draws as: one by name, or `'auto'` for a bar when
 *  the stage has a sound `split` and a diamond otherwise. */
export type BranchChoice =
  | 'auto' | 'diamond' | 'bar' | 'demux' | 'switch' | 'hexagon' | 'step' | 'comparator' | 'crossover' | 'fork';


const bar: BranchSymbol = (stage, pipeline, options) => {
  if (!canBand(stage)) return diamond(stage, pipeline, options);
  const cuts = stage.split.at;
  const exits = stage.outputs ?? [];
  const n = exits.length;
  const ink = styleOf(stage, options).text;
  const tints = tintsOf(stage, options);
  const marks: DataMark[] = [];
  exits.forEach((_, i) => {
    const top = 1 - (i + 1) / n;
    marks.push({ d: `M0 ${top} H1 V${1 - i / n} H0 Z`, fill: tints[i % tints.length]!, opacity: 0.3 });
  });
  cuts.forEach((_, k) => marks.push({ d: `M-0.25 ${1 - (k + 1) / n} H1.25`, stroke: ink }));
  marks.push(...cutLabels(cuts, n), title(stage, options));
  return {
    outline: 'rect',
    lines: [],
    padding: 0,
    width: 24,
    height: Math.max(72, 30 * n),
    ports: [...inputs(stage, pipeline, options, stage.split.input), ...bandExits(exits)],
    marks,
  };
};

const demux: BranchSymbol = (stage, pipeline, options) => {
  const exits = stage.outputs ?? [];
  return {
    outline: 'trapezoid',
    lines: [],
    padding: 0,
    width: 44,
    height: Math.max(64, 28 * exits.length),
    ports: [...inputs(stage, pipeline, options), ...spread(exits, 'right')],
    marks: [title(stage, options)],
  };
};

const LEVER_FIRST = 'M0.2 0.5 L0.78 0.27';
const CONTACT_FIRST = dot(0.8, 0.25, 0.07);
const CONTACT_SECOND = dot(0.8, 0.75, 0.07);
/** A `switch` is drawn thrown to its first exit. Each of its marks that moves
 *  when it is thrown to the second, by path data, and the path it takes then:
 *  the lever, and the two contacts, which trade places so the filled one is
 *  the closed one. */
const THROWN_ALONG: readonly (readonly [string, string])[] = [
  [LEVER_FIRST, 'M0.2 0.5 L0.78 0.73'],
  [CONTACT_FIRST, CONTACT_SECOND],
  [CONTACT_SECOND, CONTACT_FIRST],
];
const THROWN_SECOND: ReadonlyMap<string, string> = new Map([
  ...THROWN_ALONG,
  ...THROWN_ALONG.map(([from, to]) => [transposeD(from), transposeD(to)] as const),
]);

/** The path data a `switch` mark drawn as `d` takes with the lever thrown to
 *  the stage's second exit, or `undefined` for a mark that stays put. */
export const thrownToSecond = (d: string): string | undefined => THROWN_SECOND.get(d);

const switchSymbol: BranchSymbol = (stage, pipeline, options) => {
  if (!twoExits(stage)) return diamond(stage, pipeline, options);
  const exits = stage.outputs ?? [];
  const ink = styleOf(stage, options).text;
  return {
    outline: 'rect',
    lines: [],
    padding: 0,
    width: 48,
    height: 48,
    ports: [
      ...inputs(stage, pipeline, options),
      ...exits.map((p, i): PortSpec => ({ id: p.id, type: p.type, at: { u: 1, v: i === 0 ? 0.25 : 0.75 } })),
    ],
    marks: [
      { d: 'M0 0.5 H0.2 M0.8 0.25 H1 M0.8 0.75 H1', stroke: ink },
      { d: LEVER_FIRST, stroke: ink, strokeWidth: 2.5 },
      { d: dot(0.2, 0.5, 0.07), fill: ink },
      { d: CONTACT_FIRST, fill: ink },
      { d: CONTACT_SECOND, stroke: ink },
      title(stage, options),
    ],
  };
};

/** Each branch symbol by name. One called on a stage it cannot draw draws
 *  the `diamond` instead: a `bar`, `step` or `crossover` with no sound split,
 *  or a `switch` or `comparator` without exactly two exits. */
export const BRANCH_SYMBOLS: Readonly<Record<Exclude<BranchChoice, 'auto'>, BranchSymbol>> = Object.freeze({
  diamond: flowing(diamond),
  bar: flowing(bar),
  demux: flowing(demux),
  switch: flowing(switchSymbol),
  hexagon: flowing(hexagon),
  step: flowing(step),
  comparator: flowing(comparator),
  crossover: flowing(crossover),
  fork: flowing(fork),
});

/** What a symbol needs of a stage to draw it; one not listed draws any decision. */
const NEEDS: Partial<Record<Exclude<BranchChoice, 'auto'>, (stage: EffectStage) => boolean>> = {
  bar: canBand,
  step: canBand,
  crossover: canBand,
  switch: twoExits,
  comparator: twoExits,
};

/** The symbol `choice` comes to for `stage`: `'auto'` a bar for a sound
 *  split, and any symbol that cannot draw the stage the diamond. */
export function symbolNameFor(stage: EffectStage, choice: BranchChoice = 'auto'): Exclude<BranchChoice, 'auto'> {
  const want = choice === 'auto' ? (canBand(stage) ? 'bar' : 'diamond') : choice;
  return NEEDS[want]?.(stage) === false ? 'diamond' : want;
}

/** The node a decision stage draws as, by the symbol `choice` comes to. */
export function branchNode(
  stage: EffectStage, pipeline: EffectPipeline, choice: BranchChoice = 'auto', options?: BranchOptions,
): BranchNode {
  return BRANCH_SYMBOLS[symbolNameFor(stage, choice)](stage, pipeline, options);
}
