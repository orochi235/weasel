import type { MenuShortcut } from '@weasel-js/menu';
import { keySpecsFromShortcut } from './keySpecsFromShortcut';
import { detectPlatform, type KeyLegend, type LegendStyle, type Platform } from './keySpecsFromMods';

/** A keyboard shortcut as the formatters read it: `@weasel-js/menu`'s `MenuShortcut`. */
export type ShortcutInput = MenuShortcut;

/** Options for {@link formatShortcut} and {@link formatShortcutParts}. */
export interface FormatShortcutOptions {
  /** Defaults to the detected platform. */
  platform?: Platform;
  /** {@link formatShortcutParts} only; {@link formatShortcut} picks its own. Defaults to `'auto'`. */
  legend?: LegendStyle;
}

/** One keymap on the way to a key: its label, and the chips of the leader that opens it. */
export interface ShortcutLeaderStep {
  label: string;
  keys: readonly KeyLegend[];
}

/** A shortcut as display chips: {@link formatShortcutParts}'s result. */
export interface ShortcutParts {
  /** The keymaps leading to the key, outermost first; empty for a key outside any keymap. */
  leader: readonly ShortcutLeaderStep[];
  /** The key's own chips: the modifiers, then the key. */
  keys: readonly KeyLegend[];
}

/** What {@link formatShortcut} writes after each leader step's label: `Loupe ▸ 2`. */
export const SHORTCUT_LEADER_SEPARATOR = ' ▸ ';

/** Format a shortcut as display chips, one per key: the modifiers, then the
 *  key, each as the platform's keyboard prints it, so `mod` is `⌘` on macOS
 *  and `Ctrl` elsewhere, after the keymaps that lead to it (`Loupe ▸ 2`).
 *  UIs that want a boxed per-key look render each chip in its own element.
 *  `shift: 'optional'` gives an optional chip. */
export function formatShortcutParts(
  b: ShortcutInput | undefined,
  opts: FormatShortcutOptions = {},
): ShortcutParts | undefined {
  const keys = keySpecsFromShortcut(b, opts);
  if (!b || !keys) return undefined;
  const leader = (b.leader ?? []).map((l) => ({ label: l.label, keys: keySpecsFromShortcut(l.shortcut, opts) ?? [] }));
  return { leader, keys };
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
  const mac = platform === 'macos';
  const parts = formatShortcutParts(b && { ...b, shift: b.shift === true }, mac ? { platform } : { platform, legend: 'text' });
  if (!parts) return undefined;
  const keys = parts.keys.map((k) => k.label).join(mac ? '' : '+');
  return [...parts.leader.map((l) => `${l.label}${SHORTCUT_LEADER_SEPARATOR}`), keys].join('');
}
