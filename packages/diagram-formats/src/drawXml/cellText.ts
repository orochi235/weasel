/** A cell's `value` as lines of text: plain, or HTML with its tags stripped and its breaks kept. */
import { decodeEntities } from '../graphRead';

const OPEN = '\u0001';
const CLOSE = '\u0002';
/** The elements a browser lays out as blocks, each on lines of its own. */
const BLOCKS = 'address|article|aside|blockquote|caption|center|dd|details|dialog|div|dl|dt|fieldset|figcaption|figure|footer|form|'
  + 'h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|tbody|tfoot|thead|tr|ul';
const BLOCK_OPEN = new RegExp(`<(?:${BLOCKS})\\b[^>]*>`, 'gi');
const BLOCK_CLOSE = new RegExp(`<\\/(?:${BLOCKS})\\s*>`, 'gi');
/** A `pre` element: its open tag, its content, and its close tag. */
const PRE = /(<pre\b[^>]*>)([\s\S]*?)(<\/pre\s*>|$)/gi;
/** A space inside a `pre`, which no fold or trim touches. */
const KEPT = '\u0003';

const fold = (html: string): string => html.replace(/[ \t\n\r\f]+/g, ' ');

/** `pre` content as a browser lays it out: a newline right after the open tag dropped, the rest of its whitespace kept. */
const kept = (text: string): string => text.replace(/^\r?\n/, '').replace(/\r\n?/g, '\n').replace(/ /g, KEPT).replace(/\n/g, '<br>');

/** `html` with its whitespace folded outside a `pre`, and kept inside one. */
function spaced(html: string): string {
  let out = '';
  let at = 0;
  for (const m of html.matchAll(PRE)) {
    out += fold(html.slice(at, m.index)) + m[1]! + kept(m[2]!) + m[3]!;
    at = m.index + m[0].length;
  }
  return out + fold(html.slice(at));
}

/** HTML as text, where a break is a line break, a block starts and ends a line, table cells sit a space apart, and a run of whitespace is one space,
 *  dropped at either end of a line, except inside a `pre`, as a browser lays it out. */
function htmlText(html: string): string {
  const marked = spaced(html)
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
  return decodeEntities(out.replace(/ *\n */g, '\n').replace(/^ +| +$/g, '').replaceAll(KEPT, ' '));
}

/** `value` as lines. With `html`, tags are stripped, whitespace folds, `<br>` and block elements break lines, and entities are decoded. Empty lines at either end are dropped. */
export function cellLines(value: string, html: boolean): string[] {
  const lines = (html ? htmlText(value) : value).replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n');
  while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
  return lines;
}
