/** Mermaid's `@{ … }` metadata, which flowchart nodes and kanban cards share. */
import { lineError } from '../../lineError';

/** `ticket: MC-1, assigned: 'knsv'` as its pairs, values unquoted. A quoted value may hold commas and braces.
 *  Throws, naming `line` and calling the text `what`, on text that is not pairs. */
export function metaOf(meta: string, line: number, what = 'node metadata'): [string, string][] {
  const out: [string, string][] = [];
  const text = meta.trim();
  const re = /\s*([\w-]+)\s*:\s*('[^']*'|"[^"]*"|[^,]*?)\s*(?:,|$)/y;
  for (re.lastIndex = 0; re.lastIndex < text.length;) {
    const at = re.lastIndex;
    const m = re.exec(text);
    if (m === null || m[0] === '') throw lineError('Mermaid', line, `cannot read "${text.slice(at).trim()}" as ${what}`);
    out.push([m[1]!, /^(['"]).*\1$/s.test(m[2]!) ? m[2]!.slice(1, -1) : m[2]!]);
  }
  return out;
}

/** Where the `}` closing metadata that opens at `from` stands, past any quoted `}`; -1 for none. */
export function metaEnd(text: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < text.length; i++) {
    const c = text[i]!;
    if (quote !== null) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '}') return i;
  }
  return -1;
}
