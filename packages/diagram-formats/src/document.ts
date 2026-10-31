/**
 * The interchange document every format reads and writes: a diagram's pages,
 * each holding a `DiagramData`, and the theme it is drawn in. Only
 * `documentFromScene` and `documentSpecs` know scenes, so a codec is written
 * once for a chart and for a data-backed host alike.
 */
import type { DataEdge, DiagramData, DiagramTheme, LayoutDirection, LayoutOptions } from '@weasel-js/diagram';

/** What every page has: its sheet size. Ids share one namespace across the whole document. */
export interface PageBase {
  id: string;
  name?: string;
  width: number;
  height: number;
}

/** A page of nodes and edges, in coordinates from the page's top-left corner. */
export interface GraphPage extends PageBase {
  kind: 'graph';
  data: DiagramData;
  /** The way layout runs when the page is laid out on import, which it is when a node has no `at`. */
  direction?: LayoutDirection;
  /** The layout that runs when the page is laid out on import. Unset, `layered`. */
  layout?: PageLayout;
  /** What the graph models, such as `'class'` or `'state'`: a format with a notation of that name writes it in
   *  that notation. Unset, a plain flowchart. */
  notation?: string;
}

/** A layout by name, and the options a file can carry for it. */
export interface PageLayout {
  name: 'layered' | 'tree' | 'force' | 'chain';
  options?: Pick<LayoutOptions, 'nodeGap' | 'rankGap' | 'order' | 'chainSide' | 'treeSides'>;
}

/** One page of a document; `kind` says what its `data` is. */
export type DocumentPage = GraphPage;

/** The kinds of page a document can hold. */
export type PageKind = DocumentPage['kind'];

/** A diagram as every format reads and writes it. */
export interface DiagramDocument {
  pages: readonly DocumentPage[];
  /**
   * Edges the scene splits off-page, and edges whose ends export to different pages: their ends, ports, router,
   * label, and colors. One the scene splits off-page carries no waypoints,
   * since it draws as two stubs ending at off-page tags; one it keeps whole
   * (an end in the gap between pages) keeps them, in world coordinates.
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
  /** The kinds of page it reads and writes. A writer leaves out a page of any other kind, with a warning. */
  kinds: readonly PageKind[];
}

/** The page a one-page format writes: the one `opts.page` names, else the first. `null` for a document with none. */
export function writtenPage(doc: DiagramDocument, opts: WriteOptions = {}): DocumentPage | null {
  return doc.pages.find((p) => p.id === opts.page) ?? doc.pages[0] ?? null;
}

/** `page` as a graph, for a format that writes graphs only. Throws on a page of any other kind. */
export function graphPageOf(page: DocumentPage, format: string): GraphPage {
  if (page.kind !== 'graph') throw new Error(`${format} writes graph pages only; this page holds a ${(page as DocumentPage).kind}`);
  return page;
}

/** The graph pages of `doc`, warning once for each page of another kind left out. */
export function graphPagesOf(doc: DiagramDocument, format: string, warn: (message: string) => void): GraphPage[] {
  const pages: GraphPage[] = [];
  for (const page of doc.pages) {
    if (page.kind === 'graph') pages.push(page);
    else warn(`${format} holds graph pages only; the ${(page as DocumentPage).kind} page "${(page as DocumentPage).name ?? (page as DocumentPage).id}" was left out.`);
  }
  return pages;
}

/** Whether `format` can write every page of `doc`. */
export function formatHolds(format: DiagramFormat, doc: DiagramDocument): boolean {
  return doc.pages.every((p) => format.kinds.includes(p.kind));
}
