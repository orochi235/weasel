import { keySpecsFromShortcut } from '../Keycaps/keySpecsFromShortcut';
import { detectPlatform, type KeySpecsFromModsOptions, type Platform } from '../Keycaps/keySpecsFromMods';

/** The key and modifiers the shortcut formatters read. A tool's `keybinding`
 *  has this shape and passes as-is. */
export interface ShortcutInput {
  key: string | readonly string[];
  mod?: boolean;
  alt?: boolean;
  shift?: boolean | 'optional';
}

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
 *  key. On macOS the glyphs run together (`⌘⇧Z`); elsewhere the keys are
 *  spelled out and joined with `+` (`Ctrl+Shift+Z`). Returns `undefined` for
 *  `undefined` input so callers can `??` a fallback. When `key` is an array,
 *  the first element is used. `shift: 'optional'` is treated as falsy. */
export function formatShortcut(
  b: ShortcutInput | undefined,
  opts: FormatShortcutOptions = {},
): string | undefined {
  const platform = opts.platform ?? detectPlatform();
  return platform === 'macos'
    ? labels(b, { platform })?.join('')
    : labels(b, { platform, legend: 'text' })?.join('+');
}
