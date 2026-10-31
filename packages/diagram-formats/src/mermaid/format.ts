/** Mermaid as a {@link DiagramFormat}: one format, each diagram kind read and written by its own codec. */
import type { DiagramDocument, DiagramFormat, ExportResult, ImportResult, PageKind, PlotPage, WriteOptions } from '../document';
import { writtenPage } from '../document';
import { lineError } from '../lineError';
import { readClassDiagram } from './class/read';
import { writeClassDiagram } from './class/write';
import { MERMAID_KINDS, headerWord } from './common/header';
import { readErDiagram } from './er/read';
import { writeErDiagram } from './er/write';
import { readFlowchart } from './flowchart/read';
import { writeFlowchart } from './flowchart/write';
import { readMindmap } from './mindmap/read';
import { writeMindmap } from './mindmap/write';
import { readRequirementDiagram } from './requirement/read';
import { writeRequirementDiagram } from './requirement/write';
import { readStateDiagram } from './state/read';
import { writeStateDiagram } from './state/write';
import { readMermaidXychart } from './xychart/read';
import { writeMermaidXychart } from './xychart/write';

/** A Mermaid diagram kind this format reads and writes. */
interface MermaidKind {
  /** Its header word, as an error names it. */
  name: string;
  /** What its header's first word matches. */
  header: RegExp;
  /** The kind of page it reads into and writes from. */
  page: PageKind;
  /** For a graph kind, the `notation` it reads into and writes from. The flowchart has none: it writes every graph no kind claims. */
  notation?: string;
  read(text: string): ImportResult;
  write(doc: DiagramDocument, opts?: WriteOptions): ExportResult;
}

const FLOWCHART: MermaidKind = { name: 'flowchart', header: /^(?:flowchart|graph|flowchart-elk)$/, page: 'graph', read: readFlowchart, write: writeFlowchart };

/** Every kind read, by header. */
const KINDS: readonly MermaidKind[] = [
  FLOWCHART,
  { name: 'classDiagram', header: /^classDiagram(?:-v2)?$/, page: 'graph', notation: 'class', read: readClassDiagram, write: writeClassDiagram },
  { name: 'stateDiagram', header: /^stateDiagram(?:-v2)?$/, page: 'graph', notation: 'state', read: readStateDiagram, write: writeStateDiagram },
  { name: 'erDiagram', header: /^erDiagram$/, page: 'graph', notation: 'er', read: readErDiagram, write: writeErDiagram },
  { name: 'mindmap', header: /^mindmap$/, page: 'graph', notation: 'mindmap', read: readMindmap, write: writeMindmap },
  { name: 'requirementDiagram', header: /^requirementDiagram$/, page: 'graph', notation: 'requirement', read: readRequirementDiagram, write: writeRequirementDiagram },
  { name: 'xychart', header: /^xychart(?:-beta)?$/, page: 'plot', read: readMermaidXychart, write: (doc, opts) => writeMermaidXychart(plotPageOf(doc, opts)) },
];

function plotPageOf(doc: DiagramDocument, opts?: WriteOptions): PlotPage {
  const page = writtenPage(doc, opts);
  if (page?.kind !== 'plot') throw new Error('Mermaid writes an xychart from a plot page only');
  return page;
}

const FLOWCHART_HEADER = /^(?:flowchart|graph|flowchart-elk)(?:\s+(?:TB|TD|BT|LR|RL|[<>^v]))?\s*(?:;|$)/i;

/** The kind `text` is, or a flowchart, whose reader then says what is wrong with it. Throws on a kind not read. */
function kindOf(text: string): MermaidKind {
  const header = headerWord(text);
  if (header === null) return FLOWCHART;
  const known = KINDS.find((k) => k.header.test(header.word));
  if (known !== undefined) return known;
  if (MERMAID_KINDS.test(header.word)) {
    throw lineError('Mermaid', header.line, `${header.word} diagrams are not read; only ${KINDS.map((k) => k.name).join(', ')} are`);
  }
  return FLOWCHART;
}

/** Writes the page `opts.page` names, else the first, in the kind its page kind and `notation` say. */
function writeMermaid(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const page = writtenPage(doc, opts);
  if (page === null) return FLOWCHART.write(doc, opts);
  const notation = page.kind === 'graph' ? page.notation : undefined;
  const kind = KINDS.find((k) => k.page === page.kind && k.notation === notation);
  if (kind !== undefined) return kind.write(doc, opts);
  const written = FLOWCHART.write(doc, opts);
  return notation === undefined ? written
    : { ...written, warnings: [`Mermaid has no ${notation} diagram; the page was written as a flowchart.`, ...written.warnings] };
}

/** Mermaid diagrams, one page per file, laid out on import. Any Mermaid diagram is recognized, so reading a kind not read says which it is. */
export const DIAGRAM_MERMAID: DiagramFormat = {
  id: 'mermaid',
  name: 'Mermaid',
  extensions: ['.mmd', '.mermaid'],
  detect: (text) => {
    const header = headerWord(text);
    return header !== null && (FLOWCHART_HEADER.test(header.text) || KINDS.some((k) => k !== FLOWCHART && k.header.test(header.word))
      || MERMAID_KINDS.test(header.word));
  },
  read: (text) => kindOf(text).read(text),
  write: writeMermaid,
  onePage: true,
  kinds: ['graph', 'plot'],
};
