/** What a tick label formatter knows about the column it is part of. */
export interface TickFormatCtx {
  /** Places after the point that every label in the column shares. */
  decimals: number;
  /** Distance between neighboring ticks, or 0 when the ticks were given explicitly and are not evenly spaced. */
  step: number;
}

/** Turns a tick value into its label. */
export type TickFormatter = (value: number, ctx: TickFormatCtx) => string;

const MAX_DECIMALS = 20;

/** The most places after the point any of `values` needs, for a column of ticks given rather than generated. */
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

/** `value` fixed to its column's shared decimals, with no negative zero, so a column of labels lines up. */
export function formatTick(value: number, ctx: TickFormatCtx): string {
  const text = value.toFixed(ctx.decimals);
  return /^-0(\.0*)?$/.test(text) ? text.slice(1) : text;
}
