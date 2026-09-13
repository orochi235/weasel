/**
 * Tick placement for a numeric axis. Pure — no DOM, no React.
 */

/** What a tick label formatter knows about the column it is part of. */
export interface TickFormatCtx {
  /** Places after the point that every label in the column shares. */
  decimals: number;
  /** Distance between neighboring ticks, or 0 when the ticks were given
   *  explicitly and are not evenly spaced. */
  step: number;
}

/** Turns a tick value into its label. */
export type TickFormatter = (value: number, ctx: TickFormatCtx) => string;

/** A column of ticks and the facts its labels share. */
export interface TickSet {
  values: number[];
  step: number;
  decimals: number;
}

/** Options for {@link niceTicks}. */
export interface NiceTickOptions {
  /** Smallest gap between neighboring ticks, in px. */
  minSpacing: number;
  /** Ticks closer than this to either end of the axis are dropped, in px.
   *  Default 0. */
  inset?: number;
}

const MAX_DECIMALS = 20;

/** The smallest of 1, 2 or 5 times a power of ten that is at least `rough`. */
export function niceStep(rough: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/** Places after the point a multiple of `step` needs, for a 1/2/5 step. */
export function stepDecimals(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 0;
  return Math.min(MAX_DECIMALS, Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));
}

/** The most places after the point any of `values` needs. */
export function tickDecimals(values: readonly number[]): number {
  let most = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    let d = 0;
    while (d < MAX_DECIMALS && Math.abs(Number(v.toFixed(d)) - v) > 1e-9 * Math.max(1, Math.abs(v))) d++;
    most = Math.max(most, d);
  }
  return most;
}

/**
 * Ticks at round values across `range`, drawn `pixels` long: the finest
 * 1/2/5 step that keeps neighbors `minSpacing` px apart, so a taller plot
 * gets more of them.
 */
export function niceTicks(
  range: readonly [number, number],
  pixels: number,
  options: NiceTickOptions,
): TickSet {
  const none: TickSet = { values: [], step: 0, decimals: 0 };
  const lo = Math.min(range[0], range[1]);
  const hi = Math.max(range[0], range[1]);
  const span = hi - lo;
  const { minSpacing, inset = 0 } = options;
  if (!(span > 0) || !Number.isFinite(span) || !(pixels > 0) || !(minSpacing > 0)) return none;

  const unitsPerPx = span / pixels;
  const step = niceStep(minSpacing * unitsPerPx);
  const decimals = stepDecimals(step);
  const from = lo + inset * unitsPerPx;
  const to = hi - inset * unitsPerPx;
  // A tolerance in step units, so a tick sitting exactly on a bound survives
  // the float error in `from / step`.
  const first = Math.ceil(from / step - 1e-9);
  const last = Math.floor(to / step + 1e-9);
  const values: number[] = [];
  for (let i = first; i <= last; i++) values.push(Number((i * step).toFixed(decimals)) + 0);
  return { values, step, decimals };
}

/** The default label: `value` fixed to the column's shared decimals, with
 *  no negative zero. */
export function formatTick(value: number, ctx: TickFormatCtx): string {
  const text = value.toFixed(ctx.decimals);
  return /^-0(\.0*)?$/.test(text) ? text.slice(1) : text;
}
