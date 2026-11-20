/** Graphviz DOT as a {@link DiagramFormat}. */
import type { DiagramFormat } from '../document';
import { readDot } from './read';
import { writeDot } from './write';

/** Comments, and the quoted strings a comment marker inside of opens none. */
const COMMENTS = /("(?:[^"\\]|\\[\s\S])*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*|^[^\S\n]*#[^\n]*/gm;
const KEYWORD = /^\s*(?:strict\s+)?(?:di)?graph\s*/i;
const ID = /^(?:[A-Za-z_\u0080-￿][\w\u0080-￿]*|-?(?:\.\d+|\d+(?:\.\d*)?)|"(?:[^"\\]|\\.)*")?\s*\{/;

/** Whether `text`, its comments gone, opens with a graph header: the keywords, an id, then `{`. An HTML id is read
 *  to its matching `>`, as the lexer reads one. */
function hasHeader(text: string): boolean {
  const keyword = KEYWORD.exec(text);
  if (keyword === null) return false;
  let at = keyword[0].length;
  if (text[at] === '<') {
    let depth = 0;
    for (; at < text.length; at++) {
      if (text[at] === '<') depth++;
      else if (text[at] === '>' && --depth === 0) break;
    }
    if (depth !== 0) return false;
    at++;
    return /^\s*\{/.test(text.slice(at));
  }
  return ID.test(text.slice(at));
}

/** A Graphviz DOT graph, one page per file, laid out on import unless every node has a `pos`. */
export const DIAGRAM_DOT: DiagramFormat = {
  id: 'graphviz-dot',
  name: 'Graphviz DOT',
  extensions: ['.dot', '.gv'],
  detect: (text) => hasHeader(text.replace(COMMENTS, (_, quoted: string | undefined) => quoted ?? '')),
  read: readDot,
  write: writeDot,
  onePage: true,
  kinds: ['graph'],
};
