/** What every branch symbol is built from: its types, where its ports go, and
 *  the diamond each one falls back to. */
import type { DataNode, NodeStyle } from '../fromData';
import type { DataMark } from '../marks';
import type { PortAnchor, PortSpec } from '../types';
import { splitProblem } from './check';
import { isControl, stageStyle } from './draw';
import type { EffectPipeline, EffectPort, EffectStage } from './types';

/** What a branch symbol draws: a data node without its id or style, which the look adds. */
export type BranchNode = Pick<DataNode, 'outline' | 'lines' | 'rows' | 'ports' | 'marks' | 'width' | 'height' | 'padding'>;
/** How a look wants a branch symbol drawn. */
export interface BranchOptions {
  /** Which way the signal runs through the symbol: in on the left and out on
   *  the right, or, for `'down'`, in at the top and out at the bottom. Default `'right'`. */
  direction?: 'right' | 'down';
  /** The edge control inputs enter by: the side the stages driving them sit
   *  on, `'top'` or `'bottom'` along a row and `'left'` or `'right'` down a
   *  column. A side the signal runs through counts as the default, `'top'`
   *  along a row and `'left'` down a column. */
  controlSide?: 'top' | 'bottom' | 'left' | 'right';
  /** The style the look draws the stage's node in: lines, dots and ticks
   *  take its `text` color. Default `stageStyle(stage)`. */
  style?: NodeStyle;
  /** The colors of a `bar`'s bands and a `crossover`'s curves, lowest
   *  first, repeating. Default a palette of four, or for a bypassed stage
   *  `style.stroke` for every band. */
  tints?: readonly string[];
}
/** Draws one decision stage, with a port for each of its inputs and outputs. */
export type BranchSymbol = (stage: EffectStage, pipeline: EffectPipeline, options?: BranchOptions) => BranchNode;

export type Side = 'left' | 'top' | 'right' | 'bottom';
/** Puts ports along one side of a symbol, in order. */
export type Place = (ports: readonly EffectPort[], side: Side) => PortSpec[];

/** The `i`th of `n` points spread evenly along one side of the box. */
function along(side: Side, i: number, n: number): PortAnchor {
  const t = (i + 1) / (n + 1);
  if (side === 'left') return { u: 0, v: t };
  if (side === 'right') return { u: 1, v: t };
  return side === 'top' ? { u: t, v: 0 } : { u: t, v: 1 };
}

/** Ports spread evenly along a side of the box. */
export const spread: Place = (ports, side) => ports.map((p, i) => ({ id: p.id, type: p.type, at: along(side, i, ports.length) }));

/** The point `t` of the way along a polyline in the unit square, by length. */
export function alongLine(points: readonly (readonly [number, number])[], t: number): PortAnchor {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i]![0], p[1] - points[i]![1]));
  let left = t * lengths.reduce((a, b) => a + b, 0);
  for (const [i, len] of lengths.entries()) {
    if (left <= len || i === lengths.length - 1) {
      const k = len === 0 ? 0 : Math.min(left / len, 1);
      const [a, b] = [points[i]!, points[i + 1]!];
      return { u: a[0] + (b[0] - a[0]) * k, v: a[1] + (b[1] - a[1]) * k };
    }
    left -= len;
  }
  return { u: points[0]![0], v: points[0]![1] };
}

/** A `Place` that spreads each side's ports along a polyline of its own. */
export const placeAlong = (sides: Readonly<Record<Side, readonly (readonly [number, number])[]>>): Place =>
  (ports, side) => ports.map((p, i) => ({ id: p.id, type: p.type, at: alongLine(sides[side], (i + 1) / (ports.length + 1)) }));

/** Inputs split into the signal (left) and what steers the branch (`controlSide`). */
export function inputs(
  stage: EffectStage, pipeline: EffectPipeline, options: BranchOptions | undefined, steer?: string, place: Place = spread,
): PortSpec[] {
  const all = stage.inputs ?? [];
  const steering = all.filter((p) => isControl(pipeline, p.type) || (p.id === steer && all.length > 1));
  const side = options?.controlSide === 'bottom' ? 'bottom' : 'top';
  return [...place(all.filter((p) => !steering.includes(p)), 'left'), ...place(steering, side)];
}

/** The stage's title on the side of the symbol away from its control inputs,
 *  `gap` from that edge: under it, or over it when control comes from below. */
export const title = (stage: EffectStage, options: BranchOptions | undefined, gap = 4): DataMark =>
  (options?.controlSide === 'bottom'
    ? { text: stage.title, at: { u: 0.5, v: 0 }, self: { u: 0.5, v: 1 }, offset: { x: 0, y: -gap } }
    : { text: stage.title, at: { u: 0.5, v: 1 }, self: { u: 0.5, v: 0 }, offset: { x: 0, y: gap } });

/** Control from below enters a diamond by its lower-left edge, leaving the
 *  bottom vertex to the second exit. */
const DIAMOND_SIDES = placeAlong({
  left: [[0, 0], [0, 1]], top: [[0.5, 0], [0.5, 0]], right: [[1, 0], [1, 1]], bottom: [[0, 0.5], [0.5, 1]],
});

/** Two exits leave by the right vertex and by the bottom one, or the top
 *  when that faces the wire better and no input holds it. */
export const diamond: BranchSymbol = (stage, pipeline, options) => {
  const exits = stage.outputs ?? [];
  const ins = inputs(stage, pipeline, options, undefined, options?.controlSide === 'bottom' ? DIAMOND_SIDES : spread);
  const topFree = !ins.some((p) => p.at.v === 0);
  const out: PortSpec[] = exits.length === 2
    ? [
        { id: exits[0]!.id, type: exits[0]!.type, at: { u: 1, v: 0.5 } },
        { id: exits[1]!.id, type: exits[1]!.type, at: { u: 0.5, v: 1 }, ...(topFree ? { sites: [{ u: 0.5, v: 0 }] } : {}) },
      ]
    : spread(exits, 'right');
  return { outline: 'diamond', lines: [stage.title], ports: [...ins, ...out] };
};

const BAND_TINTS = ['#c58bff', '#6fb3ff', '#5ad07f', '#f2c14e'];

export const styleOf = (stage: EffectStage, options: BranchOptions | undefined): NodeStyle => options?.style ?? stageStyle(stage);

/** The colors a symbol draws its bands in, lowest first. */
export const tintsOf = (stage: EffectStage, options: BranchOptions | undefined): readonly string[] =>
  options?.tints ?? (stage.bypassed === true ? [styleOf(stage, options).stroke] : BAND_TINTS);

/** Whether the stage has a sound split to band. */
export const canBand = (stage: EffectStage): stage is EffectStage & { split: NonNullable<EffectStage['split']> } =>
  stage.split !== undefined && splitProblem(stage) === null;

/** Whether the stage has exactly two exits, as a `switch` and a `comparator` need. */
export const twoExits = (stage: EffectStage): boolean => (stage.outputs ?? []).length === 2;

/** Each exit of a banded symbol on the right edge, at the middle of its band, lowest at the bottom. */
export const bandExits = (exits: readonly EffectPort[]): PortSpec[] =>
  exits.map((p, i) => ({ id: p.id, type: p.type, at: { u: 1, v: 1 - (i + 0.5) / exits.length } }));

/** A banded symbol's cut values, at the left edge beside each cut. */
export const cutLabels = (cuts: readonly number[], n: number): DataMark[] => cuts.map((cut, k) => ({
  text: String(cut), at: { u: 0, v: 1 - (k + 1) / n }, self: { u: 1, v: 0.5 }, offset: { x: -10, y: 0 },
}));

/** A filled dot of radius `r` at (`cx`, `cy`), in the unit square. */
export const dot = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
