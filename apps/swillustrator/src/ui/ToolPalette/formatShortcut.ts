import type { KeyBinding } from '@orochi235/weasel';

/** Format a `KeyBinding` as a display string. Order: mod, shift, alt, key.
 *  Returns `undefined` for `undefined` input so callers can `??` a fallback.
 *  When `key` is an array, the first element is used. `shift: 'optional'` is
 *  treated as falsy (no ⇧ symbol shown).
 */
export function formatShortcut(b: KeyBinding | undefined): string | undefined {
  if (!b) return undefined;
  const keyChar = (Array.isArray(b.key) ? b.key[0] : b.key).toUpperCase();
  const parts = [
    b.mod && '⌘',
    b.shift === true && '⇧',
    b.alt && '⌥',
    keyChar,
  ];
  return parts.filter(Boolean).join('');
}
