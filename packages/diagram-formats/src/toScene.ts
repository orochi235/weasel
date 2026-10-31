/** A {@link DiagramDocument} as scene specs and document values: what every import draws from. */
import { PAGES_DOC_KEY, layoutPages, type Page, type SerializedDoc } from '@weasel-js/core';
import {
  DIAGRAM_THEME_KEY, diagramScene, diagramThemeFrom, themeDocValue, type DiagramData, type DiagramSpec, type DiagramTheme,
  type MeasureRowText,
} from '@weasel-js/diagram';
import type { DiagramDocument } from './document';
import { laidOutPage, needsLayout } from './pageLayout';
import { plotPageSpecs } from './plotPages';
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

/**
 * The scene a document draws as. Its pages are placed with core's
 * `layoutPages`, as a scene's `core:pages` places them. A page whose nodes
 * all have a place is drawn where they say; any other page is laid out first,
 * with `layered`, its placed nodes pinned (and grows to hold the result). Then
 * every page, moved to its place, and the edges between pages are drawn by one
 * `diagramScene` call with no layout, so the scene holds places and routes and
 * no layout runs again. A plot page is one plot root filling its page, its
 * marks under it (`plotSpecs`), drawn in the theme's colors.
 */
export function documentSpecs<TLayer extends string = 'main'>(
  document: DiagramDocument, opts: DocumentSpecsOptions<TLayer> = {},
): DocumentScene<TLayer> {
  const theme = opts.theme ?? diagramThemeFrom(document.theme);
  const measure = opts.measure ? { measure: opts.measure } : {};
  const pages = document.pages.map((p) => (p.kind === 'graph' && needsLayout(p) ? laidOutPage(p, { theme, ...measure }) : p));
  const pageList: Page[] = pages.map(({ id, name, width, height }) => ({ id, ...(name !== undefined ? { name } : {}), width, height }));
  const placed = layoutPages(pageList);
  const data: DiagramData = { nodes: [], edges: [], groups: [], containers: [] };
  pages.forEach((page, i) => {
    if (page.kind !== 'graph') return;
    const shifted = shiftData(page.data, placed[i]!);
    data.nodes = [...data.nodes, ...shifted.nodes];
    data.edges = [...data.edges, ...shifted.edges];
    data.groups = [...data.groups!, ...(shifted.groups ?? [])];
    data.containers = [...data.containers!, ...(shifted.containers ?? [])];
  });
  data.edges = [...data.edges, ...(document.crossPageEdges ?? [])];
  const layer = (opts.layer ?? 'main') as TLayer;
  const specs = diagramScene(data, { layout: 'none', theme, layer, ...measure });
  // A plot page is one plot root filling the page; its scene data is the plot package's, which a diagram scene
  // carries as it carries any node's.
  pages.forEach((page, i) => {
    if (page.kind === 'plot') specs.push(...(plotPageSpecs(page, placed[i]!, { layer, theme, ...measure }) as unknown as DiagramSpec<TLayer>[]));
  });
  return { specs, doc: { [PAGES_DOC_KEY]: { pages: pageList }, [DIAGRAM_THEME_KEY]: themeDocValue(theme) } };
}
