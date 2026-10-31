/** A template as a new scene, or as one more page of one. */
import { addPage, layoutPages, nextPageId, pagesOf, type Page, type Scene } from '@weasel-js/core';
import { DIAGRAM_TYPE_DOC_KEY, diagramTypeDocValue } from '@weasel-js/diagram';
import { documentSpecs, pageSpecs, type DocumentScene, type DocumentSpecsOptions } from '../toScene';
import type { PageTemplate } from './catalog';

/** A new document of one page made from `template`, as {@link documentSpecs} draws it, with the diagram type the
 *  template names. */
export function templateSpecs<TLayer extends string = 'main'>(
  template: PageTemplate, opts: DocumentSpecsOptions<TLayer> & { size?: { width: number; height: number } } = {},
): DocumentScene<TLayer> {
  const { size, ...draw } = opts;
  const scene = documentSpecs({ pages: [template.page('page-1', size)] }, draw);
  if (template.diagramType === undefined) return scene;
  return { ...scene, doc: { ...scene.doc, [DIAGRAM_TYPE_DOC_KEY]: diagramTypeDocValue(template.diagramType) } };
}

/** Options for {@link addTemplatePage}. */
export interface AddTemplatePageOptions<TLayer extends string = 'main'> extends DocumentSpecsOptions<TLayer> {
  /** Where the page goes in the page order. Default last. */
  index?: number;
  /** A graph page's size. Default the template's. */
  size?: { width: number; height: number };
}

/** Adds a page made from `template` to `scene`, and what it draws on it, as one undo entry, `Add page`. Returns the new
 *  page's id. */
export function addTemplatePage<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>, template: PageTemplate, opts: AddTemplatePageOptions<TLayer> = {},
): string {
  const { index, size, ...draw } = opts;
  const doc = pagesOf(scene as never);
  const pages = doc?.pages ?? [];
  const id = nextPageId(pages);
  const at = index ?? pages.length;
  const placeAt = (page: Page) => layoutPages([...pages.slice(0, at), page, ...pages.slice(at)], doc?.layout)[at]!;
  const { page, specs } = pageSpecs(template.page(id, size), placeAt, draw);
  scene.batch('Add page', () => {
    addPage(scene, page, { index: at });
    for (const spec of specs) scene.add(spec as never);
  });
  return id;
}
