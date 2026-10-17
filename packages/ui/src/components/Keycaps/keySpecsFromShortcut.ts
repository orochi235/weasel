import type { MenuShortcut } from '@weasel-js/menu';
import type { KeySpec } from './Keycaps';
import { keySpecFromKey, keySpecsFromMods, type KeySpecsFromModsOptions, type LogicalModSpec } from './keySpecsFromMods';

/**
 * A shortcut as `KeySequence` keys, one per key: mod, shift, alt, then the
 * key, each in the platform's own legend (`⌘` on macOS, `Ctrl` elsewhere).
 * `formatShortcutParts` is these labels as strings. `shift: 'optional'`
 * becomes an optional key; a key list
 * renders its first key. Returns `undefined` for no shortcut.
 *
 * ```tsx
 * <KeySequence keys={keySpecsFromShortcut({ key: 'z', mod: true, shift: true })} />
 * ```
 */
export function keySpecsFromShortcut(
  shortcut: MenuShortcut | undefined,
  opts: KeySpecsFromModsOptions = {},
): readonly KeySpec[] | undefined {
  if (!shortcut) return undefined;
  const mods: LogicalModSpec[] = [];
  if (shortcut.mod) mods.push({ name: 'mod' });
  if (shortcut.shift) mods.push(shortcut.shift === 'optional' ? { name: 'shift', optional: true } : { name: 'shift' });
  if (shortcut.alt) mods.push({ name: 'alt' });
  const key = typeof shortcut.key === 'string' ? shortcut.key : shortcut.key[0];
  const keys = keySpecsFromMods(mods, opts);
  return key === undefined ? keys : [...keys, keySpecFromKey(key, opts)];
}
