import { keyLegendFromKey } from '@weasel-js/gestures';

/** Apple-style legend for a DOM `KeyboardEvent.key` value, as `keyLegendFromKey` gives it on macOS: a glyph for
 *  escape, delete/backspace, arrows, enter/return, tab, and space, a single character upper-cased (`'a'` reads as
 *  `A`), and any other key's short name (`Home`, `PgUp`). Safe to apply to any key without checking for a glyph. */
export function keyGlyph(rawKey: string): string {
  return keyLegendFromKey(rawKey, { platform: 'macos' }).label;
}
