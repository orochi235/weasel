/** Writing a document as draw-style XML: every page, uncompressed, its colors spelled out under the document's theme. */
import { diagramThemeFrom } from '@weasel-js/diagram';
import { graphPagesOf, type DiagramDocument, type ExportResult } from '../document';
import { writePage } from './writePage';

/**
 * Writes every page of `doc` as a `<diagram>` in one `<mxfile>`. Each item's
 * colors are the ones it is drawn in under the document's theme, so the file
 * looks the same anywhere. A route is written as `waypoints`, else `routed`.
 * Edges between pages are left out, with a warning: a page's cells cannot
 * reach another's.
 */
export function writeDrawXml(doc: DiagramDocument): ExportResult {
  const theme = diagramThemeFrom(doc.theme);
  const warnings = new Set<string>();
  const warn = (message: string): void => { warnings.add(message); };
  const pages = graphPagesOf(doc, 'Draw-style XML', warn).map((page, i) => writePage(page, i, theme, warn)).join('');
  if ((doc.crossPageEdges ?? []).length > 0) warn('Connectors between pages were left out: a page\'s cells cannot reach another\'s.');
  return { text: `<mxfile>\n${pages}</mxfile>\n`, warnings: [...warnings] };
}
