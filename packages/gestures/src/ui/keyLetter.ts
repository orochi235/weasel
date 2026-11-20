import { isOneChar } from '@weasel-js/registry';

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
  shiftKey?: boolean;
}

/** The modifiers any one of which makes a keystroke a chord, as {@link chordKey} reads it. */
export const CHORD_MODIFIERS = ['alt', 'ctrl', 'meta'] as const;

/**
 * The key a shortcut reads `e` as: what it typed, or, for a chord (Alt, Ctrl or Cmd held) that typed no Latin letter
 * or digit, the letter or digit its key bears. So Ctrl+я on a Russian layout reads as `Z`, as do Option+Z on a Mac
 * (Ω) and a dead key, and AZERTY's Ctrl+& reads as `1`: an unshifted digit-row key typing punctuation reads as its
 * digit. A key pressed alone, a shifted one (Ctrl+Shift+1 typing `!`), AltGr's character with its Ctrl and Alt taken
 * off, and AZERTY's A on the Q key are what they typed.
 */
export function chordKey(e: ChordSource): string {
  if (!CHORD_MODIFIERS.some((m) => e[`${m}Key`])) return e.key;
  if (e.key === 'Dead' || (isOneChar(e.key) && !/[\x20-\x7e]/.test(e.key))) return codeLetter(e.code ?? '') ?? e.key;
  if (!e.shiftKey && /^[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]$/.test(e.key) && /^Digit[0-9]$/.test(e.code ?? '')) {
    return codeLetter(e.code!)!;
  }
  return e.key;
}
