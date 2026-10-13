import type { KeySpec } from './Keycaps';
import { keySpecsFromShortcut } from './keySpecsFromShortcut';
import { keySpecsFromMods, type KeySpecsFromModsOptions, type LogicalMod } from './keySpecsFromMods';

const MODS: Readonly<Record<string, LogicalMod>> = { mod: 'mod', shift: 'shift', alt: 'alt' };

/**
 * A shortcut written for any platform, as prose names one (`Mod+Shift+Z`, `Alt`, `Escape`), as `KeySequence`
 * keys in the reader's own legend: `Mod` is `⌘` on macOS and `Ctrl` elsewhere. `Mod`, `Shift`, and `Alt` are the
 * modifiers; any other part is the key, named as `KeyboardEvent.key` names it.
 */
export function keySpecsFromChord(chord: string, opts: KeySpecsFromModsOptions = {}): readonly KeySpec[] {
  // A trailing `+` is the plus key itself: `Mod++`.
  const parts = chord.trim().split(/\+(?=.)/).map((part) => part.trim());
  const mods = parts.flatMap((part) => MODS[part.toLowerCase()] ?? []);
  const key = parts.find((part) => !(part.toLowerCase() in MODS));
  if (key === undefined) return keySpecsFromMods(mods.map((name) => ({ name })), opts);
  return keySpecsFromShortcut({ key, mod: mods.includes('mod'), shift: mods.includes('shift'), alt: mods.includes('alt') }, opts) ?? [];
}
