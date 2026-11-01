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
  /** How large the frame is drawn in the world: every `drawnAt` of the scopes. */
  magnification: number;
}

const STEPS = [1, 2, 5];
const DECADES = [-3, -2, -1, 0, 1, 2, 3, 4];
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
  // Below one of a unit only the smallest unit counts: a tenth of a foot is 1.2″.
  const lengths = opts.lengths?.map((v) => resolveUnit(v, system))
    ?? units.flatMap(({ factor }, i) => DECADES.filter((d) => i === 0 || d >= 0)
      .flatMap((d) => STEPS.map((s) => Number((s * 10 ** d * factor).toPrecision(12)))));
  const sorted = [...new Set(lengths)].sort((a, b) => a - b);
  let length = sorted[0]!;
  for (const l of sorted) if (l * pxPerBase <= maxPx) length = l;
  const fills = [...units].reverse().filter((u) => length / u.factor >= 1 - 1e-9);
  const whole = fills.find((u) => Math.abs(length / u.factor - Math.round(length / u.factor)) < 1e-9);
  const unit = (whole ?? fills[0])?.unit ?? system.base;
  return { length, px: length * pxPerBase, label: formatUnit(length, unit, system, { precision: 3 }), magnification };
}
