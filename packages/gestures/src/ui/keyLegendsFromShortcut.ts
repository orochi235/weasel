import type { ShortcutInput } from './formatShortcut';
import { keyLegendFromKey, keyLegendsFromMods, type KeyLegend, type KeyLegendOptions, type LogicalModSpec } from './keyLegendsFromMods';

/**
 * A shortcut as key legends, one per key, as `@weasel-js/ui`'s `KeySequence` draws them: mod, shift, alt, then the
 * key, each in the platform's own legend (`⌘` on macOS, `Ctrl` elsewhere).
 * Only the key itself: `formatShortcutParts` adds the keymaps that lead to it. `shift: 'optional'`
 * becomes an optional key; a key list
 * renders its first key. Returns `undefined` for no shortcut.
 *
 * ```tsx
 * <KeySequence keys={keyLegendsFromShortcut({ key: 'z', mod: true, shift: true })} />
 * ```
 */
export function keyLegendsFromShortcut(
  shortcut: ShortcutInput | undefined,
  opts: KeyLegendOptions = {},
): readonly KeyLegend[] | undefined {
  if (!shortcut) return undefined;
  const mods: LogicalModSpec[] = [];
  if (shortcut.mod) mods.push({ name: 'mod' });
  if (shortcut.shift) mods.push(shortcut.shift === 'optional' ? { name: 'shift', optional: true } : { name: 'shift' });
  if (shortcut.alt) mods.push({ name: 'alt' });
  const key = typeof shortcut.key === 'string' ? shortcut.key : shortcut.key[0];
  const keys = keyLegendsFromMods(mods, opts);
  return key === undefined ? keys : [...keys, keyLegendFromKey(key, opts)];
}
