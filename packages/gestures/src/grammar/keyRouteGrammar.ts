/**
 * Mini-grammar for the `arg` slot of `keyDown` / `keyUp` routes.
 *
 *   keyRoute    = key ('?' optionalMod)*               -- a leading '?' is the '?' key
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

/** A key route split into the key itself and the modifiers whose state does
 *  not affect the match. */
export interface ParsedKeyRoute {
  key: string;
  optionalMods: readonly OptionalMod[];
}

/** Parse the `arg` slot of a `keyDown` / `keyUp` route. Throws on an empty
 *  key, an unrecognized optional modifier, or a repeated one. */
export function parseKeyRoute(input: string): ParsedKeyRoute {
  // A leading '?' is the question-mark key; the modifiers follow it.
  const key = input.startsWith('?') ? '?' : input.split('?')[0]!;
  const rest = input.slice(key.length);
  if (!key) throw new Error(`invalid key route (empty key): ${input}`);
  if (rest !== '' && !rest.startsWith('?')) throw new Error(`invalid key route (expected "?" after the key): ${input}`);
  const mods = rest === '' ? [] : rest.slice(1).split('?');
  const seen = new Set<string>();
  for (const m of mods) {
    if (!OPTIONAL_SET.has(m)) throw new Error(`unknown optional modifier "${m}" in ${input}`);
    if (seen.has(m)) throw new Error(`duplicate optional modifier "${m}" in ${input}`);
    seen.add(m);
  }
  return { key, optionalMods: mods as OptionalMod[] };
}

/** Render a parsed key route back to its canonical source form. Round-trips
 *  with `parseKeyRoute`. */
export function formatKeyRoute(r: ParsedKeyRoute): string {
  return r.optionalMods.length === 0 ? r.key : `${r.key}?${r.optionalMods.join('?')}`;
}

/** Key names whose `KeyboardEvent.key` is spelled otherwise, by lowercase name. */
const KEY_NAMES: Readonly<Record<string, string>> = { space: ' ', esc: 'Escape' };

/** The `KeyboardEvent.key` a key name in a route or a shortcut stands for:
 *  `Space` is `' '` and `Esc` is `Escape`, in any case. Other names pass through. */
export function eventKeyName(name: string): string {
  const lower = name.toLowerCase();
  return Object.hasOwn(KEY_NAMES, lower) ? KEY_NAMES[lower]! : name;
}

/** Build a runtime KeySpec from a parsed key route. Each optional modifier
 *  becomes `mods.<name>: 'optional'`. The matcher's `matchModifiers`
 *  honors `'optional'` uniformly across `mod`, `shift`, `alt`, `ctrl`,
 *  and `meta`. */
export function keyRouteToSpec(r: ParsedKeyRoute): KeySpec {
  const mods: ModSpec = {};
  for (const m of r.optionalMods) mods[m] = 'optional';
  const spec: KeySpec = { kind: 'key', key: eventKeyName(r.key) };
  if (Object.keys(mods).length > 0) spec.mods = mods;
  return spec;
}
