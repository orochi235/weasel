import type { KeyBinding } from '@orochi235/weasel';
import { keyGlyph } from '../Keycaps/keyGlyph';

/** Format a `KeyBinding` as an array of display chips, one per key — modifier
 *  icons (⌘, ↑, ⌥) followed by the key glyph. UIs that want a boxed
 *  per-key look render each chip in its own element. `shift: 'optional'` is
 *  treated as falsy. */
export function formatShortcutParts(b: KeyBinding | undefined): readonly string[] | undefined {
  if (!b) return undefined;
  const rawKey = Array.isArray(b.key) ? b.key[0] : b.key;
  const parts: string[] = [];
  if (b.mod) parts.push('⌘');
  if (b.shift === true) parts.push('⇧');
  if (b.alt) parts.push('⌥');
  parts.push(keyGlyph(rawKey));
  return parts;
}

/** Format a `KeyBinding` as a single display string. Order: mod, shift, alt,
 *  key. Returns `undefined` for `undefined` input so callers can `??` a
 *  fallback. When `key` is an array, the first element is used. `shift: 'optional'`
 *  is treated as falsy. */
export function formatShortcut(b: KeyBinding | undefined): string | undefined {
  const parts = formatShortcutParts(b);
  return parts ? parts.join('') : undefined;
}
