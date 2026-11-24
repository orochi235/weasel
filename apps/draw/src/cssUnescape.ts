/** `text` with its CSS escapes resolved: `\X` to `X`, and `\` with up to six hex digits (and one trailing space)
 *  to that code point. */
export function cssUnescape(text: string): string {
  return text.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([^]))/g, (_, hex: string | undefined, ch: string | undefined) => {
    if (hex === undefined) return ch!;
    const cp = parseInt(hex, 16);
    return cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? '\ufffd' : String.fromCodePoint(cp);
  });
}
