import type { MenuShortcut } from '@weasel-js/menu';
import { keySpecsFromShortcut } from './keySpecsFromShortcut';
import { detectPlatform, type KeySpecsFromModsOptions, type Platform } from './keySpecsFromMods';

/** A keyboard shortcut as the formatters read it: `@weasel-js/menu`'s `MenuShortcut`. */
export type ShortcutInput = MenuShortcut;

/** Options for {@link formatShortcut} and {@link formatShortcutParts}. */
export interface FormatShortcutOptions {
  /** Defaults to the detected platform. */
  platform?: Platform;
}

const labels = (b: ShortcutInput | undefined, opts: KeySpecsFromModsOptions) =>
  b ? keySpecsFromShortcut({ ...b, shift: b.shift === true }, opts)?.map((k) => k.label) : undefined;

/** Format a shortcut as an array of display chips, one per key: the
 *  modifiers, then the key, each as the platform's keyboard prints it, so
 *  `mod` is `⌘` on macOS and `Ctrl` elsewhere. UIs that want a boxed per-key
 *  look render each chip in its own element. `shift: 'optional'` is treated
 *  as falsy. */
export function formatShortcutParts(
  b: ShortcutInput | undefined,
  opts: FormatShortcutOptions = {},
): readonly string[] | undefined {
  return labels(b, opts);
}

/** Format a shortcut as a single display string. Order: mod, shift, alt,
 *  key, after each keymap that leads to it (`Loupe ▸ ⌘2`). On macOS the glyphs run together (`⌘⇧Z`); elsewhere the keys are
 *  spelled out and joined with `+` (`Ctrl+Shift+Z`). Returns `undefined` for
 *  `undefined` input so callers can `??` a fallback. When `key` is an array,
 *  the first element is used. `shift: 'optional'` is treated as falsy. */
export function formatShortcut(
  b: ShortcutInput | undefined,
  opts: FormatShortcutOptions = {},
): string | undefined {
  const platform = opts.platform ?? detectPlatform();
  const keys = platform === 'macos'
    ? labels(b, { platform })?.join('')
    : labels(b, { platform, legend: 'text' })?.join('+');
  if (keys === undefined || !b?.leader?.length) return keys;
  return [...b.leader.map((l) => `${l.label} ▸ `), keys].join('');
}
