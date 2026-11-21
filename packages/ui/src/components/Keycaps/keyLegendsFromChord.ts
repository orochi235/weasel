import type { KeyLegend } from './Keycaps';
import { keyLegendFromKey, keyLegendsFromMods, VALID_MOD_NAMES, type KeyLegendOptions, type ModifierKey } from '@weasel-js/gestures';

const isModifier = (part: string): part is ModifierKey => (VALID_MOD_NAMES as readonly string[]).includes(part);

/**
 * A shortcut written for any platform, as prose names one (`Mod+Shift+Z`, `Ctrl+Z`, `Alt`, `Escape`), as
 * `KeySequence` keys in the reader's own legend: `Mod` is `⌘` on macOS and `Ctrl` elsewhere. `Mod`, `Shift`, `Alt`,
 * `Ctrl`, and `Meta` are the modifiers, drawn in that order; every other part is a key, named as
 * `KeyboardEvent.key` names it, drawn after them as written.
 */
export function keyLegendsFromChord(chord: string, opts: KeyLegendOptions = {}): readonly KeyLegend[] {
  // A trailing `+` is the plus key itself: `Mod++`.
  const parts = chord.trim().split(/\+(?=.)/).map((part) => part.trim());
  const named = new Set(parts.map((part) => part.toLowerCase()));
  const mods = VALID_MOD_NAMES.filter((name) => named.has(name)).map((name) => ({ name }));
  const keys = parts.filter((part) => !isModifier(part.toLowerCase())).map((key) => keyLegendFromKey(key, opts));
  return [...keyLegendsFromMods(mods, opts), ...keys];
}
