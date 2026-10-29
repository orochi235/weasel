/** The branch symbols beyond the flowchart's own: a hexagon, a step glyph, a
 *  comparator, a crossover, and a bare fork. */
import { polygonFromPoints } from '@weasel-js/core/math';
import type { DataMark } from '../marks';
import type { Outline } from '../outline';
import type { PortSpec } from '../types';
import { flowing } from './symbolFlow';
import {
  bandExits, canBand, cutLabels, diamond, dot, inputs, placeAlong, styleOf, tintsOf, title, twoExits, type BranchSymbol,
} from './symbolParts';
import type { EffectPort } from './types';

type Pt = readonly [number, number];
const outlineOf = (points: readonly Pt[]): Outline => polygonFromPoints(points.map(([x, y]) => ({ x, y })));

/** How far a hexagon's points reach in from its sides, of its width: the `'hexagon'` outline's. */
const POINT = 0.2;
const onHexagon = placeAlong({
  left: [[POINT, 0], [0, 0.5], [POINT, 1]],
  right: [[1 - POINT, 0], [1, 0.5], [1 - POINT, 1]],
  top: [[POINT, 0], [1 - POINT, 0]],
  bottom: [[POINT, 1], [1 - POINT, 1]],
});

/** The stage's title inside a flat hexagon, on one line: the signal enters
 *  by the left point and the exits leave along the right ones. */
export const hexagon: BranchSymbol = (stage, pipeline, options) => ({
  outline: 'hexagon',
  lines: [stage.title],
  ports: [...inputs(stage, pipeline, options, undefined, onHexagon), ...onHexagon(stage.outputs ?? [], 'right')],
});

const CUT_SIZE = 10;
const CUT_GAP = 3;
/** Wider than a digit, a point or a minus sign at `CUT_SIZE` in any UI face. */
const CUT_CHAR = 0.6 * CUT_SIZE;

/** A step along a row, its title `titleGap` from the edge its cut labels hang off. */
const stepAlong = (titleGap: number): BranchSymbol => (stage, pipeline, options) => {
  if (!canBand(stage)) return diamond(stage, pipeline, options);
  const exits = stage.outputs ?? [];
  const n = exits.length;
  const ink = styleOf(stage, options).text;
  const level = (i: number) => 1 - (i + 0.5) / n;
  const riser = (k: number) => 0.1 + (0.8 * (k + 1)) / n;
  let stairs = `M0 ${level(0)}`;
  for (let k = 0; k < n - 1; k++) stairs += ` H${riser(k)} V${level(k + 1)}`;
  const marks: DataMark[] = [{ d: `${stairs} H1`, stroke: ink, strokeWidth: 2 }];
  for (let i = 0; i < n - 1; i++) marks.push({ d: `M${riser(i)} ${level(i)} H1`, stroke: ink, dash: [2, 2], opacity: 0.5 });
  stage.split.at.forEach((cut, k) => marks.push({
    text: String(cut), at: { u: riser(k), v: 1 }, self: { u: 0.5, v: 0 }, offset: { x: 0, y: CUT_GAP }, style: { fontSize: CUT_SIZE },
  }));
  marks.push(title(stage, options, titleGap));
  return {
    outline: 'rect',
    lines: [],
    padding: 0,
    width: 56,
    height: Math.max(48, 24 * n),
    ports: [...inputs(stage, pipeline, options, stage.split.input), ...bandExits(exits)],
    marks,
  };
};

/** A staircase rising a step at each cut, from the lowest band on the left
 *  to the highest on the right, each band's level led out to its exit.
 *  Turned down a column, the title and the cut labels share the right edge,
 *  so the title moves out past the widest label. */
export const step: BranchSymbol = (stage, pipeline, options) => {
  if (options?.direction !== 'down') return stepAlong(18)(stage, pipeline, options);
  if (options.controlSide === 'right') return flowing(stepAlong(18))(stage, pipeline, options);
  const widest = Math.max(0, ...(stage.split?.at ?? []).map((cut) => String(cut).length * CUT_CHAR));
  return flowing(stepAlong(Math.max(18, CUT_GAP + widest + 4)))(stage, pipeline, options);
};

const TRIANGLE: readonly Pt[] = [[0, 0], [1, 0.5], [0, 1]];
const COMPARATOR = outlineOf(TRIANGLE);
/** How far along a comparator's slanted edges, from its left side, its exits leave. */
const EXIT_AT = 0.7;
const onTriangle = placeAlong({
  left: [[0, 0], [0, 1]],
  right: [[1, 0.5], [1, 0.5]],
  // The first part of each slanted edge, short of the exits.
  top: [[0, 0], [0.6, 0.3]],
  bottom: [[0, 1], [0.6, 0.7]],
});

/** A comparator, a triangle pointing right: the signal enters its flat side,
 *  marked `+` and `−` when two inputs meet there, and the two exits leave by
 *  its slanted edges near the point. With a sound split the high band leaves
 *  by the upper edge, its cut written inside; otherwise the first exit does. */
export const comparator: BranchSymbol = (stage, pipeline, options) => {
  if (!twoExits(stage)) return diamond(stage, pipeline, options);
  const outs = stage.outputs!;
  const banded = canBand(stage);
  const [upper, lower] = banded ? [outs[1]!, outs[0]!] : [outs[0]!, outs[1]!];
  const ins = inputs(stage, pipeline, options, undefined, onTriangle);
  const signal = ins.filter((p) => p.at.u === 0);
  const ink = styleOf(stage, options).text;
  const marks: DataMark[] = [];
  if (canBand(stage)) marks.push({ text: String(stage.split.at[0]), at: { u: 0.35, v: 0.5 }, self: { u: 0.5, v: 0.5 }, color: ink });
  else if (signal.length === 2) {
    signal.forEach((p, i) => marks.push({ text: i === 0 ? '+' : '−', at: p.at, self: { u: 0, v: 0.5 }, offset: { x: 4, y: 0 }, color: ink }));
  }
  marks.push(title(stage, options));
  const exit = (p: EffectPort, v: number): PortSpec => ({ id: p.id, type: p.type, at: { u: EXIT_AT, v } });
  return {
    outline: COMPARATOR,
    lines: [],
    padding: 0,
    width: 56,
    height: 56,
    ports: [...ins, exit(upper, EXIT_AT / 2), exit(lower, 1 - EXIT_AT / 2)],
    marks,
  };
};

/** One band's response, drawn with frequency rising up the box and gain to
 *  the right: flat across its band, falling away past each cut, and led out
 *  to its exit. */
function response(i: number, n: number): string {
  const lo = 1 - i / n;
  const hi = 1 - (i + 1) / n;
  const skirt = 0.25 / n;
  const rise = i === 0 ? 'M0.75 1' : `M0.15 ${lo + skirt} C0.15 ${lo} 0.75 ${lo} 0.75 ${lo - skirt}`;
  const fall = i === n - 1 ? ' V0' : ` V${hi + skirt} C0.75 ${hi} 0.15 ${hi} 0.15 ${hi - skirt}`;
  return rise + fall;
}

/** A crossover: one filter curve per band, lowest at the bottom, overlapping
 *  at each cut, the cut values beside them and each band led out to its exit. */
export const crossover: BranchSymbol = (stage, pipeline, options) => {
  if (!canBand(stage)) return diamond(stage, pipeline, options);
  const exits = stage.outputs ?? [];
  const n = exits.length;
  const ink = styleOf(stage, options).text;
  const tints = tintsOf(stage, options);
  const marks: DataMark[] = [];
  exits.forEach((_, i) => {
    marks.push({ d: response(i, n), stroke: tints[i % tints.length]!, strokeWidth: 1.5 });
    marks.push({ d: `M0.75 ${1 - (i + 0.5) / n} H1`, stroke: ink });
  });
  marks.push(...cutLabels(stage.split.at, n), title(stage, options));
  return {
    outline: 'rect',
    lines: [],
    padding: 0,
    width: 56,
    height: Math.max(56, 28 * n),
    ports: [...inputs(stage, pipeline, options, stage.split.input), ...bandExits(exits)],
    marks,
  };
};

const atPoint = (p: Pt): readonly Pt[] => [p, p];
const onDot = placeAlong({ left: atPoint([0, 0.5]), right: atPoint([1, 0.5]), top: atPoint([0.5, 0]), bottom: atPoint([0.5, 1]) });
/** How wide a fork's dot is. */
const FORK = 12;

/** A bare fork: a dot every exit leaves from, the title beside it, and the
 *  conditions left to the labels on its wires. */
export const fork: BranchSymbol = (stage, pipeline, options) => ({
  outline: 'stadium',
  lines: [],
  padding: 0,
  width: FORK,
  height: FORK,
  ports: [...inputs(stage, pipeline, options, undefined, onDot), ...onDot(stage.outputs ?? [], 'right')],
  marks: [{ d: dot(0.5, 0.5, 0.5), fill: styleOf(stage, options).text }, title(stage, options)],
});
