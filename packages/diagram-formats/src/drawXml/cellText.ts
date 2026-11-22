/** A cell's `value` as lines of text: plain, or HTML with its tags stripped and its breaks kept. */
import { decodeEntities } from '../graphRead';

const OPEN = '\u0001';
const CLOSE = '\u0002';
/** The elements a browser lays out as blocks, each on lines of its own. */
const BLOCKS = 'address|article|aside|blockquote|caption|center|dd|details|dialog|div|dl|dt|fieldset|figcaption|figure|footer|form|'
  + 'h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|tbody|tfoot|thead|tr|ul';
const BLOCK_OPEN = new RegExp(`<(?:${BLOCKS})\\b[^>]*>`, 'gi');
const BLOCK_CLOSE = new RegExp(`<\\/(?:${BLOCKS})\\s*>`, 'gi');

/** HTML as text, where a break is a line break, a block starts and ends a line, table cells sit a space apart, and a run of whitespace is one space,
 *  dropped at either end of a line, as a browser lays it out. */
function htmlText(html: string): string {
  const marked = html
    .replace(/[ \t\n\r\f]+/g, ' ')
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(BLOCK_OPEN, OPEN)
    .replace(BLOCK_CLOSE, CLOSE)
    .replace(/<t[dh]\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/ {2,}/g, ' ');
  let out = '';
  for (const ch of marked) {
    const atLineStart = out === '' || out.endsWith('\n');
    if (ch === OPEN || ch === CLOSE) {
      if (!atLineStart) out += '\n';
    } else {
      out += ch;
    }
  }
  return decodeEntities(out.replace(/ *\n */g, '\n').replace(/^ +| +$/g, ''));
}

/** `value` as lines. With `html`, tags are stripped, whitespace folds, `<br>` and block elements break lines, and entities are decoded. Empty lines at either end are dropped. */
export function cellLines(value: string, html: boolean): string[] {
  const lines = (html ? htmlText(value) : value).replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n');
  while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
  return lines;
}
