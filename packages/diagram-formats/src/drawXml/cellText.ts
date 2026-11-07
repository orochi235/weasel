/** A cell's `value` as lines of text: plain, or HTML with its tags stripped and its breaks kept. */
import { decodeEntities } from '../graphRead';

const OPEN = '\u0001';
const CLOSE = '\u0002';

/** HTML as text, where a break is a line break and a block starts and ends a line, as a browser lays it out. */
function htmlText(html: string): string {
  const marked = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(div|p|li|h[1-6])\b[^>]*>/gi, OPEN)
    .replace(/<\/(div|p|li|h[1-6])\s*>/gi, CLOSE)
    .replace(/<[^>]*>/g, '');
  let out = '';
  for (const ch of marked) {
    const atLineStart = out === '' || out.endsWith('\n');
    if (ch === OPEN || ch === CLOSE) {
      if (!atLineStart) out += '\n';
    } else {
      out += ch;
    }
  }
  return decodeEntities(out);
}

/** `value` as lines. With `html`, tags are stripped, `<br>` and block elements break lines, and entities are decoded. Empty lines at either end are dropped. */
export function cellLines(value: string, html: boolean): string[] {
  const lines = (html ? htmlText(value) : value).replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n');
  while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
  return lines;
}
