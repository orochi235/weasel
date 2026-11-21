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
