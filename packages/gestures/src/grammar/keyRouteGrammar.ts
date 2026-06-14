/**
 * Mini-grammar for the `arg` slot of `keyDown` / `keyUp` routes.
 *
 *   keyRoute    = key ('?' optionalMod)*
 *   optionalMod = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta'
 *
 * `?shift` means "shift may or may not be held; either fires this route."
 * Required modifiers still belong in the route's `:modifiers` slot — this
 * grammar only widens which events match, never narrows.
 */
import type { KeySpec, ModSpec } from '../ui/spec';
import { VALID_MOD_NAMES, type ModifierKey } from './routeGrammar';

/** An optional modifier in a key route — the same set as the canonical
 *  {@link ModifierKey}. */
export type OptionalMod = ModifierKey;
const OPTIONAL_SET = new Set<string>(VALID_MOD_NAMES);

export interface ParsedKeyRoute {
  key: string;
  optionalMods: readonly OptionalMod[];
}

export function parseKeyRoute(input: string): ParsedKeyRoute {
  const [key, ...mods] = input.split('?');
  if (!key) throw new Error(`invalid key route (empty key): ${input}`);
  const seen = new Set<string>();
  for (const m of mods) {
    if (!OPTIONAL_SET.has(m)) throw new Error(`unknown optional modifier "${m}" in ${input}`);
    if (seen.has(m)) throw new Error(`duplicate optional modifier "${m}" in ${input}`);
    seen.add(m);
  }
  return { key, optionalMods: mods as OptionalMod[] };
}

export function formatKeyRoute(r: ParsedKeyRoute): string {
  return r.optionalMods.length === 0 ? r.key : `${r.key}?${r.optionalMods.join('?')}`;
}

/** Build a runtime KeySpec from a parsed key route. Each optional modifier
 *  becomes `mods.<name>: 'optional'`. The matcher's `matchModifiers`
 *  honors `'optional'` uniformly across `mod`, `shift`, `alt`, `ctrl`,
 *  and `meta`. */
export function keyRouteToSpec(r: ParsedKeyRoute): KeySpec {
  const mods: ModSpec = {};
  for (const m of r.optionalMods) mods[m] = 'optional';
  const spec: KeySpec = { kind: 'key', key: r.key };
  if (Object.keys(mods).length > 0) spec.mods = mods;
  return spec;
}
