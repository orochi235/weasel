/** Graphviz DOT as a {@link DiagramFormat}. */
import type { DiagramFormat } from '../document';
import { dotTokens, type DotToken } from './lex';
import { readDot } from './read';
import { writeDot } from './write';

const word = (t: DotToken | undefined, re: RegExp) => t?.kind === 'id' && !t.quoted && !t.html && re.test(t.value);

/** Whether `text` opens with a graph header, read as the lexer reads it: the keywords, an id, then `{`. */
function hasHeader(text: string): boolean {
  try {
    const tokens = dotTokens(text);
    const next = () => {
      const r = tokens.next();
      return r.done === true ? undefined : r.value;
    };
    let t = next();
    if (word(t, /^strict$/i)) t = next();
    if (!word(t, /^(?:di)?graph$/i)) return false;
    t = next();
    if (t?.kind === 'id') t = next();
    return t?.kind === 'punct' && t.value === '{';
  } catch {
    return false;
  }
}

/** A Graphviz DOT graph, one page per file, laid out on import unless every node has a `pos`. */
export const DIAGRAM_DOT: DiagramFormat = {
  id: 'graphviz-dot',
  name: 'Graphviz DOT',
  extensions: ['.dot', '.gv'],
  detect: hasHeader,
  read: readDot,
  write: writeDot,
  onePage: true,
  kinds: ['graph'],
};
