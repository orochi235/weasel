/**
 * The interchange document every format reads and writes: a diagram's pages,
 * each holding a `DiagramData`, and the theme it is drawn in. Only
 * `documentFromScene` and `documentSpecs` know scenes, so a codec is written
 * once for a chart and for a data-backed host alike.
 */
import type { DataEdge, DiagramData, DiagramTheme, LayoutDirection } from '@weasel-js/diagram';

/**
 * One page: its sheet size, and what is on it in coordinates from the page's
 * top-left corner. Ids share one namespace across the whole document.
 */
export interface DocumentPage {
  id: string;
  name?: string;
  width: number;
  height: number;
  data: DiagramData;
  /** The way layout runs when the page is laid out on import, which it is when a node has no `at`. */
  direction?: LayoutDirection;
}

/** A diagram as every format reads and writes it. */
export interface DiagramDocument {
  pages: readonly DocumentPage[];
  /**
   * Edges whose ends sit on different pages: their ends, ports, router,
   * label, and colors. They carry no waypoints, since they draw as two stubs
   * ending at off-page tags.
   */
  crossPageEdges?: readonly DataEdge[];
  /** A shipped theme's id, or a whole theme. Unset, the host's own. */
  theme?: string | DiagramTheme;
}

/** What a format read, and what it could not carry into a diagram, one sentence each. */
export interface ImportResult {
  document: DiagramDocument;
  warnings: readonly string[];
}

/** What a format wrote, and what it could not carry out of the diagram, one sentence each. */
export interface ExportResult {
  text: string;
  warnings: readonly string[];
}

/** Options for {@link DiagramFormat.write}. */
export interface WriteOptions {
  /** The page a format with no pages writes. Default the first. */
  page?: string;
}

/** A file format a diagram can be read from or written to. */
export interface DiagramFormat {
  id: string;
  /** What a menu calls it. */
  name: string;
  /** With their dots, most usual first: `['.dot', '.gv']`. */
  extensions: readonly string[];
  /** Whether `text` looks like this format, from its content alone. */
  detect(text: string): boolean;
  /** Throws on text this format cannot read. */
  read?(text: string): ImportResult | Promise<ImportResult>;
  write?(doc: DiagramDocument, opts?: WriteOptions): ExportResult;
  /** Whether {@link write} writes one page rather than the whole document. */
  onePage?: boolean;
}

/** The page a one-page format writes: the one `opts.page` names, else the first. `null` for a document with none. */
export function writtenPage(doc: DiagramDocument, opts: WriteOptions = {}): DocumentPage | null {
  return doc.pages.find((p) => p.id === opts.page) ?? doc.pages[0] ?? null;
}
