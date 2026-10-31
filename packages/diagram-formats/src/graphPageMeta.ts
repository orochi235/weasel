/** A graph page's notation, layout, and direction, kept on its scene page so they survive the scene. */
import type { Page } from '@weasel-js/core';
import type { DocumentPage, GraphPage } from './document';

/** The key a scene page's `meta` holds a graph page's {@link GraphPageSettings} under. */
export const GRAPH_PAGE_META_KEY = 'diagram:graph';

/** What a graph page says beyond its data: how it is laid out and what it models. */
export type GraphPageSettings = Pick<GraphPage, 'direction' | 'layout' | 'notation'>;

/** `page`'s settings as a scene page's `meta`, or `undefined` when it has none. */
export function graphPageMeta(page: DocumentPage): Page['meta'] {
  if (page.kind !== 'graph') return undefined;
  const { direction, layout, notation } = page;
  const settings: GraphPageSettings = {
    ...(direction !== undefined ? { direction } : {}),
    ...(layout !== undefined ? { layout } : {}),
    ...(notation !== undefined ? { notation } : {}),
  };
  return Object.keys(settings).length > 0 ? { [GRAPH_PAGE_META_KEY]: settings } : undefined;
}

/** The graph settings scene page `page` keeps; empty when it keeps none. */
export function graphPageSettingsOf(page: Pick<Page, 'meta'>): GraphPageSettings {
  return (page.meta?.[GRAPH_PAGE_META_KEY] as GraphPageSettings | undefined) ?? {};
}
