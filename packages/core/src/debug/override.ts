import { useMemo, useState } from 'react';
import type { DebugFlags } from './types';
import { resolveDebugFlags } from './parseDebugFlags';

/** `debug` as the canvas resolves it, with `override` over it. Absent `debug` reads `?debug=` from the URL. */
export function withOverride<D extends DebugFlags>(
  debug: D | false | undefined,
  override: DebugFlags | null,
): D | DebugFlags | false | undefined {
  if (!override) return debug;
  return { ...(resolveDebugFlags(debug) ?? {}), ...override };
}

/** A canvas's `debug` prop with the flags an inspector laid over it, and the setter for them. */
export function useDebugOverride<T extends DebugFlags | false | undefined>(debug: T) {
  const [override, setOverride] = useState<DebugFlags | null>(null);
  // An override only adds feature flags, so the canvas's own config type still describes the result.
  const effective = useMemo(() => withOverride(debug, override) as T, [debug, override]);
  return { debug: effective, setOverride };
}
