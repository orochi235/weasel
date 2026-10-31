/** Mermaid as a {@link DiagramFormat}. */
import { writtenPage, type DiagramFormat } from '../document';
import { OTHER_KINDS, headerWord } from './parse';
import { readMermaid } from './read';
import { writeMermaid } from './write';
import { readMermaidXychart } from './xychart/read';
import { writeMermaidXychart } from './xychart/write';

const XYCHART = /^xychart(?:-beta)?$/;

const FLOWCHART = /^(?:flowchart|graph|flowchart-elk)(?:\s+(?:TB|TD|BT|LR|RL|[<>^v]))?\s*(?:;|$)/i;

/**
 * A Mermaid flowchart or xychart, one page per file, a flowchart laid out on
 * import. Any Mermaid diagram is recognized, so reading another kind says
 * which kind it is.
 */
export const DIAGRAM_MERMAID: DiagramFormat = {
  id: 'mermaid',
  name: 'Mermaid',
  extensions: ['.mmd', '.mermaid'],
  detect: (text) => {
    const header = headerWord(text);
    return header !== null && (FLOWCHART.test(header.text) || OTHER_KINDS.test(header.word));
  },
  read: (text) => (XYCHART.test(headerWord(text)?.word ?? '') ? readMermaidXychart(text) : readMermaid(text)),
  write: (doc, opts) => {
    const page = writtenPage(doc, opts);
    return page?.kind === 'plot' ? writeMermaidXychart(page) : writeMermaid(doc, opts);
  },
  onePage: true,
  kinds: ['graph', 'plot'],
};
