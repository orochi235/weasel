/**
 * Escaping for the XML this package writes by hand.
 *
 * XML 1.0 cannot hold most C0 controls, U+FFFE, U+FFFF, or half a surrogate
 * pair, even as character references, and a parser rejects the whole
 * document over one. A vertical tab or form feed is a line break where text
 * comes from (a word processor's clipboard), so those become `\n`; the rest
 * are dropped.
 */

const LINE_BREAK_CONTROLS = /[\u000B\u000C]/g;
const NOT_XML_CHAR = /[\u0000-\u0008\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function xmlChars(s: string): string {
  return s.replace(LINE_BREAK_CONTROLS, '\n').replace(NOT_XML_CHAR, '');
}

/** A parser turns a literal tab or line break in an attribute value into a
 *  space, so those are written as character references. */
export function escapeAttr(s: string): string {
  return xmlChars(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
    .replace(/\t/g, '&#9;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;');
}

/** A literal carriage return in content is read back as a newline. */
export function escapeText(s: string): string {
  return xmlChars(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\r/g, '&#13;');
}
