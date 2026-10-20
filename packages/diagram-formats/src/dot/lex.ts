/** Graphviz DOT's tokens: identifiers in their four spellings, punctuation, and edge operators. */
import { lineError } from '../lineError';

/** One token. An `id` is a name, a numeral, a quoted string, or an HTML string. */
export interface DotToken {
  kind: 'id' | 'punct' | 'edgeop';
  value: string;
  line: number;
  quoted?: boolean;
  html?: boolean;
}

const NAME = /[A-Za-z_\u0080-￿][\w\u0080-￿]*/y;
const NUMERAL = /-?(?:\.\d+|\d+(?:\.\d*)?)/y;
const PUNCT = '{}[];,=:';

const fail = (line: number, message: string) => lineError('DOT', line, message);

/** Splits DOT source into tokens, skipping comments. Throws, naming the line, on text it cannot read. */
export function lexDot(text: string): DotToken[] {
  const tokens: DotToken[] = [];
  let i = 0;
  let line = 1;
  let lineStart = true;
  const advance = (to: number) => {
    for (let k = i; k < to; k++) if (text[k] === '\n') line++;
    i = to;
  };
  const end = (marker: string, from: number) => {
    const at = text.indexOf(marker, from);
    return at < 0 ? text.length : at;
  };
  while (i < text.length) {
    const c = text[i]!;
    if (c === '\n') { line++; i++; lineStart = true; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '#' && lineStart) { advance(end('\n', i)); continue; }
    lineStart = false;
    if (text.startsWith('//', i)) { advance(end('\n', i)); continue; }
    if (text.startsWith('/*', i)) { advance(Math.min(text.length, end('*/', i + 2) + 2)); continue; }
    if (text.startsWith('->', i) || text.startsWith('--', i)) {
      tokens.push({ kind: 'edgeop', value: text.slice(i, i + 2), line });
      i += 2;
      continue;
    }
    if (PUNCT.includes(c)) { tokens.push({ kind: 'punct', value: c, line }); i++; continue; }
    if (c === '"') { tokens.push(quoted()); continue; }
    if (c === '<') { tokens.push(html()); continue; }
    const word = match(NUMERAL) ?? match(NAME);
    if (word === null) throw fail(line, `cannot read "${c}"`);
    tokens.push({ kind: 'id', value: word, line });
  }
  return tokens;

  function match(re: RegExp): string | null {
    re.lastIndex = i;
    const m = re.exec(text);
    if (m === null) return null;
    i += m[0].length;
    return m[0];
  }

  function quotedPart(): string {
    const start = line;
    let out = '';
    i++;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\\' && text[i + 1] === '"') { out += '"'; i += 2; continue; }
      if (text[i] === '\\' && text[i + 1] === '\n') { line++; i += 2; continue; }
      if (text[i] === '\\' && i + 1 < text.length) { out += text.slice(i, i + 2); i += 2; continue; }
      if (text[i] === '\n') line++;
      out += text[i];
      i++;
    }
    if (i >= text.length) throw fail(start, 'a quoted string is never closed');
    i++;
    return out;
  }

  function quoted(): DotToken {
    const start = line;
    let value = quotedPart();
    for (;;) {
      const rest = /\s*\+\s*"/y;
      rest.lastIndex = i;
      const m = rest.exec(text);
      if (m === null) break;
      advance(i + m[0].length - 1);
      value += quotedPart();
    }
    return { kind: 'id', value, line: start, quoted: true };
  }

  function html(): DotToken {
    const start = line;
    let depth = 0;
    let k = i;
    for (; k < text.length; k++) {
      if (text[k] === '<') depth++;
      else if (text[k] === '>' && --depth === 0) break;
    }
    if (k >= text.length) throw fail(start, 'an HTML string is never closed');
    const value = text.slice(i + 1, k);
    advance(k + 1);
    return { kind: 'id', value, line: start, html: true };
  }
}
