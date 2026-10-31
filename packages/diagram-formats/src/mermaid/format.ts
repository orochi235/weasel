/** Mermaid as a {@link DiagramFormat}. */
import type { DiagramFormat } from '../document';
import { OTHER_KINDS, headerWord } from './parse';
import { readMermaid } from './read';
import { writeMermaid } from './write';

const FLOWCHART = /^(?:flowchart|graph|flowchart-elk)(?:\s+(?:TB|TD|BT|LR|RL|[<>^v]))?\s*(?:;|$)/i;

/**
 * A Mermaid flowchart, one page per file, laid out on import. Any Mermaid
 * diagram is recognized, so reading another kind says which kind it is.
 */
export const DIAGRAM_MERMAID: DiagramFormat = {
  id: 'mermaid',
  name: 'Mermaid',
  extensions: ['.mmd', '.mermaid'],
  detect: (text) => {
    const header = headerWord(text);
    return header !== null && (FLOWCHART.test(header.text) || OTHER_KINDS.test(header.word));
  },
  read: readMermaid,
  write: writeMermaid,
  onePage: true,
  kinds: ['graph'],
};
