/** A {@link DiagramDocument} as scene specs and document values: what every import draws from. */
import { PAGES_DOC_KEY, layoutPages, type Page, type PlacedPage, type SerializedDoc } from '@weasel-js/core';
import {
  DIAGRAM_THEME_KEY, diagramScene, diagramThemeFrom, themeDocValue, type DiagramData, type DiagramSpec, type DiagramTheme,
  type MeasureRowText,
} from '@weasel-js/diagram';
import type { DiagramDocument, DocumentPage, GraphPage } from './document';
import { laidOutPage, needsLayout } from './pageLayout';
import { sequencePageSize, sequencePageSpecs } from './sequencePage';
import { shiftData } from './shiftData';

/** Options for {@link documentSpecs}. */
export interface DocumentSpecsOptions<TLayer extends string = 'main'> {
  /** The layer every spec goes on. Default `'main'`. */
  layer?: TLayer;
  /** The theme to draw in. Default the one the document names, else the night theme. */
  theme?: DiagramTheme;
  /** Measures text. Default an estimate from character count. */
  measure?: MeasureRowText;
}

/** What {@link documentSpecs} returns: the nodes, and the `core:pages` and `diagram:theme` document values. */
export interface DocumentScene<TLayer extends string = 'main'> {
  specs: DiagramSpec<TLayer>[];
  doc: SerializedDoc;
}

type Draw = { theme: DiagramTheme; measure?: MeasureRowText };

/** `page` ready to place: a graph laid out if it needs it, a sequence grown to hold its layout. */
function prepared(page: DocumentPage, draw: Draw): DocumentPage {
  if (page.kind === 'sequence') return { ...page, ...sequencePageSize(page, draw) };
  return needsLayout(page) ? laidOutPage(page, draw) : page;
}

/**
 * Every graph page, moved to its place, and the edges between pages, drawn by one `diagramScene` call with no layout,
 * so the scene holds places and routes and no layout runs again.
 */
function graphSpecs(pages: readonly { page: GraphPage; at: PlacedPage }[], document: DiagramDocument, draw: Draw): DiagramSpec[] {
  const data: DiagramData = { nodes: [], edges: [], groups: [], containers: [] };
  for (const { page, at } of pages) {
    const shifted = shiftData(page.data, at);
    data.nodes = [...data.nodes, ...shifted.nodes];
    data.edges = [...data.edges, ...shifted.edges];
    data.groups = [...data.groups!, ...(shifted.groups ?? [])];
    data.containers = [...data.containers!, ...(shifted.containers ?? [])];
  }
  data.edges = [...data.edges, ...(document.crossPageEdges ?? [])];
  return diagramScene(data, { layout: 'none', ...draw });
}

/**
 * The scene a document draws as. Its pages are placed with core's
 * `layoutPages`, as a scene's `core:pages` places them. A graph page whose
 * nodes all have a place is drawn where they say; any other is laid out
 * first, with `layered`, its placed nodes pinned (and grows to hold the
 * result). A sequence page is drawn from its data, one root holding it, and
 * grows to hold its layout.
 */
export function documentSpecs<TLayer extends string = 'main'>(
  document: DiagramDocument, opts: DocumentSpecsOptions<TLayer> = {},
): DocumentScene<TLayer> {
  const theme = opts.theme ?? diagramThemeFrom(document.theme);
  const draw: Draw = { theme, ...(opts.measure ? { measure: opts.measure } : {}) };
  const pages = document.pages.map((p) => prepared(p, draw));
  const pageList: Page[] = pages.map(({ id, name, width, height }) => ({ id, ...(name !== undefined ? { name } : {}), width, height }));
  const placed = layoutPages(pageList);
  const graphs = pages.flatMap((page, i) => (page.kind === 'graph' ? [{ page, at: placed[i]! }] : []));
  const specs = [
    ...graphSpecs(graphs, document, draw),
    ...pages.flatMap((page, i) => (page.kind === 'sequence' ? sequencePageSpecs(page, placed[i]!, draw) : [])),
  ].map((s) => ({ ...s, layer: (opts.layer ?? 'main') as TLayer })) as DiagramSpec<TLayer>[];
  return { specs, doc: { [PAGES_DOC_KEY]: { pages: pageList }, [DIAGRAM_THEME_KEY]: themeDocValue(theme) } };
}
