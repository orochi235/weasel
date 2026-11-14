import { niceStep } from '@weasel-js/geom';
import { magnificationOf, toRoot, type UnitScope } from './scope';
import { entryScale, formatUnit, resolveUnit, type Unit, type UnitValue } from './units';

/** Options for {@link scaleBar}. */
export interface ScaleBarOptions {
  /** Screen pixels one world unit (a root base unit) covers at the view's zoom. */
  pxPerUnit: number;
  /** The unit scopes of the frame the bar measures, outermost first: what
   *  `sceneSharedUnitScopes` returns for the nodes it is read beside. */
  scopes: readonly UnitScope[];
  /** The longest the bar may be, in screen pixels. Default 140. */
  maxPx?: number;
  /** The lengths it chooses among, in the innermost scope's units. Default:
   *  1, 2 and 5 of every decade of every unit that scope's system carries. */
  lengths?: readonly UnitValue[];
}

/** A scale bar's length and label. */
export interface ScaleBar {
  /** In the innermost scope's base units. */
  length: number;
  /** Its length on screen. */
  px: number;
  /** The length in the largest of the scope's units it is a whole number of. */
  label: string;
  /** The unit `label` is written in: what a reading counted in steps of
   *  `length` is written in too, as a ruler's tick labels are. */
  unit: Unit;
  /** How large the frame is drawn in the world: every `drawnAt` of the scopes. */
  magnification: number;
}

/** The shortest and longest default length, in a unit: a thousandth of the smallest, fifty thousand of any. */
const SHORTEST = 1e-3;
const LONGEST = 5e4;
const plain = (unit: Unit, entry: ReturnType<typeof entryScale>) => ({ unit, factor: entry.factor, offset: entry.offset });

/**
 * The longest round length that fits in `maxPx` in the frame `scopes` names,
 * or the shortest when none does. It measures the frame's own lengths: inside
 * a scope drawn at 0.4×, a bar labeled 10″ spans 4″ of the world around it.
 */
export function scaleBar(opts: ScaleBarOptions): ScaleBar {
  const inner = opts.scopes[opts.scopes.length - 1];
  if (inner === undefined) throw new Error('scaleBar: scopes is empty; pass at least the root scope');
  const { system } = inner;
  const maxPx = opts.maxPx ?? 140;
  const magnification = magnificationOf(opts.scopes);
  const pxPerBase = opts.pxPerUnit * (toRoot(1, opts.scopes) - toRoot(0, opts.scopes)) * magnification;
  const units = Object.entries(system.units)
    .map(([unit, entry]) => plain(unit, entryScale(entry)))
    .filter((u) => u.offset === 0 && u.factor > 0)
    .sort((a, b) => a.factor - b.factor);
  const fit = maxPx / pxPerBase;
  const length = opts.lengths
    ? longestFitting(opts.lengths.map((v) => resolveUnit(v, system)), fit)
    : longestNice(units.map((u) => u.factor), fit);
  const fills = [...units].reverse().filter((u) => length / u.factor >= 1 - 1e-9);
  const whole = fills.find((u) => Math.abs(length / u.factor - Math.round(length / u.factor)) < 1e-9);
  const unit = (whole ?? fills[0])?.unit ?? system.base;
  return { length, px: length * pxPerBase, label: formatUnit(length, unit, system, { precision: 3 }), unit, magnification };
}

/** The longest of `lengths` no longer than `fit`, or the shortest when none is. */
function longestFitting(lengths: readonly number[], fit: number): number {
  const sorted = [...lengths].sort((a, b) => a - b);
  let length = sorted[0]!;
  for (const l of sorted) if (l <= fit) length = l;
  return length;
}

/** The longest 1-2-5 length of any unit no longer than `fit`, or a thousandth of the smallest unit when none is.
 *  Below one of a unit only the smallest unit counts: a tenth of a foot is 1.2″. */
function longestNice(factors: readonly number[], fit: number): number {
  let length = SHORTEST * (factors[0] ?? 1);
  factors.forEach((factor, i) => {
    const n = Math.min(niceStep(fit / factor, 'down'), LONGEST);
    const l = Number((n * factor).toPrecision(12));
    if (n >= (i === 0 ? SHORTEST : 1) && l > length) length = l;
  });
  return length;
}
