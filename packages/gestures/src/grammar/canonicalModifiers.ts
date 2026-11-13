import type { ParsedModifiers } from './routeGrammar';

/** Stable canonical serialization of a ParsedModifiers map for use as a
 *  hash key (conflicts dedup). Sorts mod names alphabetically and emits
 *  `name=req` pairs joined by `&`. */
export function canonicalModifiers(mods: ParsedModifiers): string {
  return Object.entries(mods)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, req]) => `${name}=${req}`)
    .join('&');
}
