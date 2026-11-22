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

/** The most places after the point any of `values` needs, for a column of ticks given rather than generated: each to
 *  a billionth of itself, so small ticks keep their digits. */
export function tickDecimals(values: readonly number[]): number {
  let most = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    let d = 0;
    while (d < MAX_DECIMALS && Math.abs(Number(v.toFixed(d)) - v) > 1e-9 * Math.abs(v)) d++;
    most = Math.max(most, d);
  }
  return most;
}

/** `value.toFixed(decimals)`, without the exponent `toFixed` switches to at 1e21, and with `decimals` held to the 0 to
 *  100 `toFixed` takes rather than throwing past them. */
export function toFixedPlain(value: number, places: number): string {
  const decimals = Math.min(100, Math.max(0, Math.trunc(places) || 0));
  if (!(Math.abs(value) >= 1e21) || !Number.isFinite(value)) return value.toFixed(decimals);
  return plainDigits(value) + (decimals > 0 ? `.${'0'.repeat(decimals)}` : '');
}

/** A value of 1e21 or more written out in the shortest digits that read back as it, not its binary expansion. */
function plainDigits(value: number): string {
  const [mantissa = '', exponent = '0'] = String(Math.abs(value)).split('e+');
  const point = mantissa.indexOf('.');
  const whole = (point < 0 ? mantissa.length : point) + Number(exponent);
  return (value < 0 ? '-' : '') + mantissa.replace('.', '').padEnd(whole, '0');
}

/** The smallest step whose places `toFixed` can write. */
export const FINEST_STEP = 10 ** -100;

/** `value` fixed to its column's shared decimals, with no negative zero, so a column of labels lines up. A step or a
 *  value finer than `toFixed` writes takes the exponent instead, rather than reading 0. */
export function formatTick(value: number, ctx: TickFormatCtx): string {
  if ((ctx.step > 0 && ctx.step < FINEST_STEP) || (value !== 0 && Math.abs(value) < FINEST_STEP)) return String(Number(value.toPrecision(12)));
  const text = toFixedPlain(value, ctx.decimals);
  return /^-0(\.0*)?$/.test(text) ? text.slice(1) : text;
}
