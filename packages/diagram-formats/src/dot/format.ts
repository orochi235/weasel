/** Graphviz DOT as a {@link DiagramFormat}. */
import type { DiagramFormat } from '../document';
import { readDot } from './read';
import { writeDot } from './write';

const COMMENTS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|^#[^\n]*/gm;
const HEADER = /^\s*(?:strict\s+)?(?:di)?graph\s*(?:[A-Za-z_\u0080-￿][\w\u0080-￿]*|-?(?:\.\d+|\d+(?:\.\d*)?)|"(?:[^"\\]|\\.)*")?\s*\{/i;

/** A Graphviz DOT graph, one page per file, laid out on import unless every node has a `pos`. */
export const DIAGRAM_DOT: DiagramFormat = {
  id: 'graphviz-dot',
  name: 'Graphviz DOT',
  extensions: ['.dot', '.gv'],
  detect: (text) => HEADER.test(text.replace(COMMENTS, '')),
  read: readDot,
  write: writeDot,
  onePage: true,
};
