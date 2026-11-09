import { formatUnit, scaleBar, toRoot, type Unit, type UnitScope, type UnitValue } from '@weasel-js/quantity';

/** Options for {@link rulerTicks}. */
export interface RulerTicksOptions {
  /** Screen pixels one world unit covers along the ruler: the view's `scale.x`
   *  for a horizontal ruler, `scale.y` for a vertical one. Negative on a
   *  flipped axis. */
  pxPerUnit: number;
  /** The world coordinate at the ruler's screen 0: the view's `x` or `y`. */
  start: number;
  /** The ruler's length on screen, in px. */
  length: number;
  /** The unit scopes of the frame it reads, outermost first. */
  scopes: readonly UnitScope[];
  /** The world coordinate that reads 0. Default 0. */
  origin?: number;
  /** The most screen px between labeled ticks. Default 100. */
  majorPx?: number;
  /** The least screen px between unlabeled ticks; fewer subdivisions are drawn
   *  before they crowd closer. Default 6. */
  minorPx?: number;
  /** The lengths a labeled step chooses among, as `scaleBar` takes them. */
  lengths?: readonly UnitValue[];
}

/** One tick of a ruler. */
export interface RulerTick {
  /** Where it falls along the ruler, in screen px from its start. */
  at: number;
  /** Whether it is labeled. */
  major: boolean;
  /** Its reading, in the step's `unit` and without a suffix; on major ticks only. */
  label?: string;
}

/** What {@link rulerTicks} lays out: no ticks once labeled ones would sit under a pixel apart. */
export interface RulerTicks {
  ticks: RulerTick[];
  /** The step between labeled ticks, in the innermost scope's base units. */
  step: number;
  /** The unit the labels read in. */
  unit: Unit;
  /** How many parts each step is cut into by unlabeled ticks: 1 for none. */
  subdivisions: number;
  /** How large the frame is drawn in the world: every `drawnAt` of `scopes`. */
  magnification: number;
}

const SUBDIVISIONS = [10, 5, 2];

/**
 * The ticks of a ruler over a stretch of a 2D view, read in a frame's unit
 * scopes. The labeled step is the one `scaleBar` picks for `majorPx`, so a
 * ruler and a scale bar at the same zoom agree, and inside a frame drawn at a
 * declared magnification the labels read its true lengths.
 */
export function rulerTicks(opts: RulerTicksOptions): RulerTicks {
  const { pxPerUnit, start, length, scopes } = opts;
  const origin = opts.origin ?? 0;
  const bar = scaleBar({
    pxPerUnit: Math.abs(pxPerUnit), scopes, maxPx: opts.majorPx ?? 100,
    ...(opts.lengths ? { lengths: opts.lengths } : {}),
  });
  const system = scopes[scopes.length - 1]!.system;
  const minorPx = opts.minorPx ?? 6;
  const subdivisions = SUBDIVISIONS.find((n) => bar.px / n >= minorPx) ?? 1;
  const worldPerBase = (toRoot(1, scopes) - toRoot(0, scopes)) * bar.magnification;
  const minorWorld = (bar.length * worldPerBase) / subdivisions;
  const ticks: RulerTick[] = [];
  // Zoomed out past the longest step there is, ticks would number in the millions.
  if (!(minorWorld > 0) || !(length > 0) || !(bar.px >= 1)) return { ticks, step: bar.length, unit: bar.unit, subdivisions, magnification: bar.magnification };
  const end = start + length / pxPerUnit;
  const lo = Math.ceil((Math.min(start, end) - origin) / minorWorld - 1e-9);
  const hi = Math.floor((Math.max(start, end) - origin) / minorWorld + 1e-9);
  for (let j = lo; j <= hi; j++) {
    const at = (origin + j * minorWorld - start) * pxPerUnit || 0;
    if (j % subdivisions !== 0) {
      ticks.push({ at, major: false });
      continue;
    }
    const label = formatUnit((j / subdivisions) * bar.length, bar.unit, system, { precision: 3, suffix: false });
    ticks.push({ at, major: true, label });
  }
  if (pxPerUnit < 0) ticks.reverse();
  return { ticks, step: bar.length, unit: bar.unit, subdivisions, magnification: bar.magnification };
}
