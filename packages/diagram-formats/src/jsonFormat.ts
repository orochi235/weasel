/** The native format: a {@link DiagramDocument} written out as JSON, which carries everything the model holds. */
import type { DiagramDocument, DiagramFormat, DocumentPage, ExportResult, ImportResult } from './document';

const FORMAT = 'weasel-diagram';
const VERSION = 1;

interface DiagramJson extends DiagramDocument {
  format: typeof FORMAT;
  version: number;
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const isDiagramJson = (value: unknown): value is Partial<DiagramJson> =>
  value !== null && typeof value === 'object' && (value as { format?: unknown }).format === FORMAT;

function read(text: string): ImportResult {
  const json = parsed(text);
  if (!isDiagramJson(json)) throw new Error('Not a weasel diagram document');
  if (typeof json.version !== 'number' || json.version > VERSION) {
    throw new Error(`A weasel diagram document of version ${String(json.version)}, newer than this reader's ${VERSION}`);
  }
  if (!Array.isArray(json.pages)) throw new Error('A weasel diagram document with no pages list');
  const { format: _f, version: _v, ...document } = json as DiagramJson;
  // Files written before pages had kinds hold only graphs.
  const pages = document.pages.map((p) => ({ ...p, kind: p.kind ?? 'graph' }) as DocumentPage);
  return { document: { ...document, pages }, warnings: [] };
}

function write(doc: DiagramDocument): ExportResult {
  const json: DiagramJson = { format: FORMAT, version: VERSION, ...doc };
  return { text: `${JSON.stringify(json, null, 2)}\n`, warnings: [] };
}

/** A diagram document as JSON, every page in one file, recognized by its `format` field. */
export const DIAGRAM_JSON: DiagramFormat = {
  id: FORMAT,
  name: 'Diagram JSON',
  extensions: ['.diagram.json'],
  detect: (text) => isDiagramJson(parsed(text)),
  read,
  write,
  kinds: ['graph', 'sequence'],
};
