/** `defaults` with `params` laid over it, where a key set to `undefined` keeps its default. */
export function withDefaults<P extends object>(defaults: P, params: Partial<P> | undefined): P {
  const out = { ...defaults };
  if (!params) return out;
  for (const key of Object.keys(params) as (keyof P)[]) {
    const value = params[key];
    if (value !== undefined) out[key] = value as P[keyof P];
  }
  return out;
}

/** `n` held to `[lo, hi]`, where NaN reads as `fallback` (held there too). */
export function clampParam(n: number, lo: number, hi: number, fallback: number): number {
  return Math.max(lo, Math.min(Number.isNaN(n) ? fallback : n, hi));
}

/** The most repeats (points, teeth) a shape draws, so a huge or infinite count cannot hang a render. */
export const MAX_REPEATS = 256;

/** A whole repeat count in `[min, max]`; NaN and anything below `min` read as `min`. */
export function repeatCount(n: number, min: number, max: number = MAX_REPEATS): number {
  return Math.min(max, Math.max(min, Math.floor(n) || min));
}
