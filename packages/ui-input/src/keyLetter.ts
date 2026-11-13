import { isOneChar } from './typeahead';

/** The letter or digit the physical key `code` bears (`KeyZ` is `'Z'`, `Digit1` is `'1'`), or undefined for any
 *  other key. */
export function codeLetter(code: string): string | undefined {
  const m = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(code);
  return m ? m[1] ?? m[2] : undefined;
}

/** A keystroke as a shortcut reads it. */
export interface ChordSource {
  key: string;
  code?: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/** The modifiers any one of which makes a keystroke a chord, as {@link chordKey} reads it. */
export const CHORD_MODIFIERS = ['alt', 'ctrl', 'meta'] as const;

/**
 * The key a shortcut reads `e` as: what it typed, or, for a chord (Alt, Ctrl or Cmd held) that typed no Latin letter
 * or digit, the letter or digit its key bears. So Ctrl+я on a Russian layout reads as `Z`, as do Option+Z on a Mac
 * (Ω) and a dead key. A key pressed alone, or AltGr's character with its Ctrl and Alt taken off, is what it typed,
 * as is AZERTY's A on the Q key.
 */
export function chordKey(e: ChordSource): string {
  if (!CHORD_MODIFIERS.some((m) => e[`${m}Key`])) return e.key;
  if (e.key !== 'Dead' && !(isOneChar(e.key) && !/[\x20-\x7e]/.test(e.key))) return e.key;
  return codeLetter(e.code ?? '') ?? e.key;
}
