import { keyGlyph } from '../Keycaps/keyGlyph';

export interface ShortcutInput {
  key: string | readonly string[];
  mod?: boolean;
  alt?: boolean;
  shift?: boolean | 'optional';
}

/** Format a shortcut as an array of display chips, one per key — modifier
 *  icons (⌘, ↑, ⌥) followed by the key glyph. UIs that want a boxed
 *  per-key look render each chip in its own element. `shift: 'optional'` is
 *  treated as falsy. */
export function formatShortcutParts(b: ShortcutInput | undefined): readonly string[] | undefined {
  if (!b) return undefined;
  const rawKey = Array.isArray(b.key) ? b.key[0] : (b.key as string);
  const parts: string[] = [];
  if (b.mod) parts.push('⌘');
  if (b.shift === true) parts.push('⇧');
  if (b.alt) parts.push('⌥');
  parts.push(keyGlyph(rawKey));
  return parts;
}

/** Format a shortcut as a single display string. Order: mod, shift, alt,
 *  key. Returns `undefined` for `undefined` input so callers can `??` a
 *  fallback. When `key` is an array, the first element is used. `shift: 'optional'`
 *  is treated as falsy. */
export function formatShortcut(b: ShortcutInput | undefined): string | undefined {
  const parts = formatShortcutParts(b);
  return parts ? parts.join('') : undefined;
}
