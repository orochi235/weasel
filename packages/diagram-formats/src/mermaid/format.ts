/** Mermaid as a {@link DiagramFormat}. */
import { writtenPage, type DiagramFormat } from '../document';
import { OTHER_KINDS, headerWord } from './parse';
import { readMermaid } from './read';
import { readMermaidSequence } from './sequence/read';
import { writeMermaidSequence } from './sequence/write';
import { writeMermaid } from './write';

const FLOWCHART = /^(?:flowchart|graph|flowchart-elk)(?:\s+(?:TB|TD|BT|LR|RL|[<>^v]))?\s*(?:;|$)/i;

/**
 * A Mermaid flowchart or sequence diagram, one page per file; a flowchart is
 * laid out on import. Any Mermaid diagram is recognized, so reading another
 * kind says which kind it is.
 */
export const DIAGRAM_MERMAID: DiagramFormat = {
  id: 'mermaid',
  name: 'Mermaid',
  extensions: ['.mmd', '.mermaid'],
  detect: (text) => {
    const header = headerWord(text);
    return header !== null && (FLOWCHART.test(header.text) || OTHER_KINDS.test(header.word));
  },
  read: (text) => (headerWord(text)?.word === 'sequenceDiagram' ? readMermaidSequence(text) : readMermaid(text)),
  write: (doc, opts) => {
    const page = writtenPage(doc, opts);
    return page?.kind === 'sequence' ? writeMermaidSequence(page) : writeMermaid(doc, opts);
  },
  onePage: true,
  kinds: ['graph', 'sequence'],
};
