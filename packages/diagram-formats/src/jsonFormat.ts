/** The native format: a {@link DiagramDocument} written out as JSON, which carries everything the model holds. */
import { diagramThemeErrors } from '@weasel-js/diagram';
import type { DiagramDocument, DiagramFormat, DocumentPage, ExportResult, ImportResult, PageKind } from './document';

const FORMAT = 'weasel-diagram';
/** 2 renamed a graph page's `groups` to `clusters` and its grid's `groupColumns` to `clusterColumns`. */
const VERSION = 2;
const KINDS: readonly PageKind[] = ['graph', 'sequence', 'plot'];

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
  for (const p of json.pages as unknown[]) {
    if (p === null || typeof p !== 'object' || Array.isArray(p)) throw new Error('A weasel diagram document with a page that is not an object');
    const kind = (p as { kind?: unknown }).kind;
    if (kind !== undefined && !(KINDS as readonly unknown[]).includes(kind)) {
      throw new Error(`A weasel diagram document with a page of kind ${JSON.stringify(kind)}, which this reader does not know`);
    }
  }
  const theme = (json as { theme?: unknown }).theme;
  if (theme !== undefined && typeof theme !== 'string') {
    const errors = diagramThemeErrors(theme);
    if (errors.length > 0) throw new Error(`A weasel diagram document whose theme does not check: ${errors.join('; ')}`);
  }
  const { format: _f, version, ...document } = json as DiagramJson;
  // Files written before pages had kinds hold only graphs.
  const pages = document.pages.map((p) => {
    const page = { ...p, kind: p.kind ?? 'graph' } as DocumentPage;
    return version < 2 && page.kind === 'graph' ? upgradeV1Page(page) : page;
  });
  return { document: { ...document, pages }, warnings: [] };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** `record` with `from` renamed to `to`, or `record` itself when it has no `from`. */
function renamed(record: Record<string, unknown>, from: string, to: string): Record<string, unknown> {
  if (!Object.hasOwn(record, from)) return record;
  const { [from]: value, ...rest } = record;
  return { ...rest, [to]: value };
}

/** A version 1 graph page in version 2's names. */
function upgradeV1Page(page: DocumentPage): DocumentPage {
  const p = page as unknown as Record<string, unknown>;
  let out = isRecord(p.data) ? { ...p, data: renamed(p.data, 'groups', 'clusters') } : p;
  const layout = p.layout;
  if (isRecord(layout) && isRecord(layout.options) && isRecord(layout.options.grid)) {
    const grid = renamed(layout.options.grid, 'groupColumns', 'clusterColumns');
    out = { ...out, layout: { ...layout, options: { ...layout.options, grid } } };
  }
  return out as unknown as DocumentPage;
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
  kinds: KINDS,
};
