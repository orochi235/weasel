/** The conversion of a scene saved with its pages as the `core:pages` document value. */
import type { Scene } from '../scene/types';
import { PAGES_DOC_KEY, pageRunOf, type PagesDoc } from './pageNodes';
import { setPages, type PageEditOptions } from './pageEdits';

type AnyScene = Scene<unknown, string, unknown>;

/**
 * Turn a scene saved with its pages as the `core:pages` document value into
 * one whose pages are nodes: make that value its pages (`setPages`, which
 * puts what the scene holds on them), then drop the value. Not an
 * undo step: it is how the document loads. Returns whether there was a value
 * to convert into a scene without pages, so a second call is `false` and
 * changes nothing; a value beside an existing page run is dropped.
 */
export function adoptLegacyPages<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  options: Pick<PageEditOptions, 'descriptor'> = {},
): boolean {
  const s = scene as unknown as AnyScene;
  const doc = s.doc.get<PagesDoc>(PAGES_DOC_KEY);
  if (doc === undefined) return false;
  if (pageRunOf(s) !== null) {
    s.untracked(() => s.doc.set(PAGES_DOC_KEY, undefined));
    return false;
  }
  s.untracked(() => s.batch('Adopt pages', () => {
    setPages(s, doc, { ...options, label: 'Adopt pages' });
    s.doc.set(PAGES_DOC_KEY, undefined);
  }));
  return true;
}
