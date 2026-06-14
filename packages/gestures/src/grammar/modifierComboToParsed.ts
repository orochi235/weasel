import type { ModifierCombo } from './modifiers';
import type { ParsedModifiers, ModifierKey } from './routeGrammar';

/** Translate the tool-authoring `ModifierCombo` enum (positional string,
 *  e.g. `'mod+shift'`) to the v3 `ParsedModifiers` structured map
 *  (every listed modifier becomes `'required'`; unlisted means
 *  forbidden / absent). `'default'` yields `{}`. */
export function modifierComboToParsed(key: ModifierCombo): ParsedModifiers {
  if (key === 'default') return {};
  const out: ParsedModifiers = {};
  for (const part of key.split('+')) {
    out[part as ModifierKey] = 'required';
  }
  return out;
}

/** Stable canonical serialization of a ParsedModifiers map for use as a
 *  hash key (conflicts dedup). Sorts mod names alphabetically and emits
 *  `name=req` pairs joined by `&`. */
export function canonicalModifiers(mods: ParsedModifiers): string {
  return Object.entries(mods)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, req]) => `${name}=${req}`)
    .join('&');
}
