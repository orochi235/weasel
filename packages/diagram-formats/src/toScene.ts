/** A {@link DiagramDocument} as scene specs and document values: what every import draws from. */
import { PAGES_DOC_KEY, layoutPages, type Page, type PlacedPage, type SerializedDoc } from '@weasel-js/core';
import {
  DIAGRAM_THEME_KEY, DIAGRAM_TYPE_DOC_KEY, diagramScene, diagramThemeFrom, diagramTypeDocValue, diagramTypeOfNotation, themeDocValue,
  type DataEdge, type DiagramData, type DiagramSpec, type DiagramTheme, type DiagramType, type MeasureRowText,
} from '@weasel-js/diagram';
import type { DiagramDocument, DocumentPage, GraphPage } from './document';
import { graphPageMeta } from './graphPageMeta';
import { laidOutPage, needsLayout } from './pageLayout';
import { plotPageSpecs } from './plotPages';
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

/** What {@link documentSpecs} returns: the nodes, and the `core:pages`, `diagram:theme`, and `diagram:type` document values. */
export interface DocumentScene<TLayer extends string = 'main'> {
  specs: DiagramSpec<TLayer>[];
  doc: SerializedDoc;
}

type Draw = { theme: DiagramTheme; measure?: MeasureRowText };

/** `page` ready to place: a graph laid out if it needs it, a sequence grown to hold its layout. */
function prepared(page: DocumentPage, draw: Draw): DocumentPage {
  if (page.kind === 'sequence') return { ...page, ...sequencePageSize(page, draw) };
  if (page.kind !== 'graph') return page;
  return needsLayout(page) ? laidOutPage(page, draw) : page;
}

/**
 * Every graph page, moved to its place, and the edges between pages, drawn by one `diagramScene` call with no layout,
 * so the scene holds places and routes and no layout runs again.
 */
function graphSpecs(pages: readonly { page: GraphPage; at: PlacedPage }[], crossPageEdges: readonly DataEdge[], draw: Draw): DiagramSpec[] {
  const data: DiagramData = { nodes: [], edges: [], groups: [], containers: [] };
  for (const { page, at } of pages) {
    const shifted = shiftData(page.data, at);
    data.nodes = [...data.nodes, ...shifted.nodes];
    data.edges = [...data.edges, ...shifted.edges];
    data.groups = [...data.groups!, ...(shifted.groups ?? [])];
    data.containers = [...data.containers!, ...(shifted.containers ?? [])];
  }
  data.edges = [...data.edges, ...crossPageEdges];
  return diagramScene(data, { layout: 'none', ...draw });
}

/**
 * The scene a document draws as. Its pages are placed with core's
 * `layoutPages`, as a scene's `core:pages` places them. A graph page whose
 * nodes all have a place is drawn where they say; any other is laid out
 * first, with `layered`, its placed nodes pinned (and grows to hold the
 * result). A sequence page is drawn from its data, one root holding it, and
 * grows to hold its layout. A plot page is one plot root filling its page, its
 * marks under it (`plotSpecs`), drawn in the theme's colors. A graph page's
 * notation, layout, and direction go on its `core:pages` page, under
 * `meta['diagram:graph']`, where `documentFromScene` reads them back. When
 * every graph page's notation is one a diagram type claims, the scene opens as
 * that type (`diagram:type`), its stencils with it.
 */
export function documentSpecs<TLayer extends string = 'main'>(
  document: DiagramDocument, opts: DocumentSpecsOptions<TLayer> = {},
): DocumentScene<TLayer> {
  const theme = opts.theme ?? diagramThemeFrom(document.theme);
  const draw: Draw = { theme, ...(opts.measure ? { measure: opts.measure } : {}) };
  const pages = document.pages.map((p) => prepared(p, draw));
  const pageList = pages.map(scenePageOf);
  const placed = layoutPages(pageList);
  const specs = placedSpecs(pages.map((page, i) => ({ page, at: placed[i]! })), document.crossPageEdges ?? [], draw, opts.layer);
  const type = typeOfGraphs(pages);
  return {
    specs,
    doc: {
      [PAGES_DOC_KEY]: { pages: pageList }, [DIAGRAM_THEME_KEY]: themeDocValue(theme),
      ...(type !== null ? { [DIAGRAM_TYPE_DOC_KEY]: diagramTypeDocValue(type.id) } : {}),
    },
  };
}

/** `page` as a scene's `core:pages` lists it, its graph settings in its `meta`. */
function scenePageOf(page: DocumentPage): Page {
  const { id, name, width, height } = page;
  const meta = graphPageMeta(page);
  return { id, ...(name !== undefined ? { name } : {}), width, height, ...(meta !== undefined ? { meta } : {}) };
}

/** Each page's nodes, drawn where it is placed, and the edges between them. */
function placedSpecs<TLayer extends string>(
  pages: readonly { page: DocumentPage; at: PlacedPage }[], crossPageEdges: readonly DataEdge[], draw: Draw, layerIn?: TLayer,
): DiagramSpec<TLayer>[] {
  const layer = (layerIn ?? 'main') as TLayer;
  const graphs = pages.flatMap(({ page, at }) => (page.kind === 'graph' ? [{ page, at }] : []));
  const specs = [
    ...graphSpecs(graphs, crossPageEdges, draw),
    ...pages.flatMap(({ page, at }) => (page.kind === 'sequence' ? sequencePageSpecs(page, at, draw) : [])),
  ].map((s) => ({ ...s, layer })) as DiagramSpec<TLayer>[];
  // A plot root's scene data is the plot package's, which a diagram scene carries as it carries any node's.
  for (const { page, at } of pages) {
    if (page.kind === 'plot') specs.push(...(plotPageSpecs(page, at, { layer, ...draw }) as unknown as DiagramSpec<TLayer>[]));
  }
  return specs;
}

/**
 * One more page for a scene: `page` as its `core:pages` lists it, and the nodes it draws as once placed where
 * `placeAt` puts it, as `documentSpecs` draws a page. A graph page with no place for a node is laid out first; a
 * sequence page grows to hold its layout.
 */
export function pageSpecs<TLayer extends string = 'main'>(
  page: DocumentPage, placeAt: (page: Page) => PlacedPage, opts: DocumentSpecsOptions<TLayer> = {},
): { page: Page; specs: DiagramSpec<TLayer>[] } {
  const draw: Draw = { theme: opts.theme ?? diagramThemeFrom(undefined), ...(opts.measure ? { measure: opts.measure } : {}) };
  const ready = prepared(page, draw);
  const listed = scenePageOf(ready);
  return { page: listed, specs: placedSpecs([{ page: ready, at: placeAt(listed) }], [], draw, opts.layer) };
}

/** The diagram type every graph page's notation names, or `null` when there are none, they differ, or no type claims it. */
function typeOfGraphs(pages: readonly DocumentPage[]): DiagramType | null {
  const types = new Set(pages.flatMap((p) => (p.kind === 'graph' ? [diagramTypeOfNotation(p.notation)] : [])));
  return types.size === 1 ? [...types][0]! : null;
}
