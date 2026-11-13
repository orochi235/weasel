/**
 * The edits that change a document's pages. A page is a node under the page
 * run, so an edit writes the page nodes, each at the place the run's layout
 * gives it; what is on a page is its children and goes with it, stored poses
 * untouched.
 */
import { freshId } from '@weasel-js/registry';
import type { PoseDescriptor } from '../geometry/poseDescriptor';
import { sameValue } from '../scene/sameValue';
import type { NodeId, RectPose, Scene } from '../scene/types';
import type { Page, PlacedPage } from './pages';
import { placeOnPages } from './placeOnPages';
import {
  addPageNode, createPageRun, pageIdsOf, pageInfo, pageNodeOf, pageOfNode, pagePoses, pageRunOf, pagesOf, placedPagesOf,
  runInfo, runPose, type PagesDoc,
} from './pageNodes';

export { PAGES_DOC_KEY, pagesOf, placedPagesOf, type PagesDoc } from './pageNodes';

/** Options every page edit takes. */
export interface PageEditOptions {
  /** The undo entry's label. */
  label?: string;
  /** What measures each root when {@link setPages} makes a scene paged and puts its content on the pages
   *  (`placeOnPages`). Not read otherwise: membership is the tree, so nothing is measured. */
  descriptor?: PoseDescriptor<unknown>;
}

type AnyScene = Scene<unknown, string, unknown>;
const asAny = <TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>) =>
  scene as unknown as AnyScene;

/** An id none of `pages` has: `page-1`, `page-2`, and so on. */
export function nextPageId(pages: readonly Page[]): string {
  return freshId('page', new Set(pages.map((p) => p.id)));
}

/** The nodes on each placed page, by page id: the page's own children. `descriptor` is not read. */
export function pageMembers<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  placed: readonly PlacedPage[] = placedPagesOf(scene),
  _descriptor?: PoseDescriptor<unknown>,
): Map<string, NodeId[]> {
  return new Map(placed.map((p) => {
    const node = pageNodeOf(scene, p.id);
    return [p.id, node === null ? [] : [...scene.childrenOf(node)]];
  }));
}

/** Put `run`'s pages in `order`, each into the slot the `k`th page holds, so its other children stay put. */
function orderPages(scene: AnyScene, run: NodeId, order: readonly NodeId[]): void {
  order.forEach((id, k) => {
    const children = scene.childrenOf(run);
    const slot = children.filter((c) => scene.get(c)?.page !== undefined)[k];
    const at = slot === undefined ? -1 : children.indexOf(slot);
    if (at >= 0 && slot !== id) scene.reorder(id, at);
  });
}

/** Bring page node `id` to `pose`, and to `page`'s name and meta. */
function writePage(scene: AnyScene, id: NodeId, page: Page, pose: RectPose): void {
  const node = scene.get(id)!;
  const to = { ...(node.pose as RectPose), ...pose };
  if (!sameValue(node.pose, to)) scene.setPose(id, to);
  const info = pageInfo(page, id);
  if (!sameValue(node.page, info)) scene.setPage(id, info);
}

/**
 * Make the scene's pages `next`, as one undo entry (`options.label`, default
 * "Set pages"): pages it
 * keeps are resized, renamed and reordered, new ones are added, and ones it
 * drops are deleted with everything on them and whatever follows that. A
 * scene with no page run gets one, and what it held goes onto the pages
 * (`placeOnPages`, measured with `options.descriptor`). Content keeps its
 * place on its page.
 */
export function setPages<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  next: PagesDoc,
  options: PageEditOptions = {},
): void {
  const s = asAny(scene);
  const { label = 'Set pages', descriptor } = options;
  const place = descriptor ? { descriptor } : {};
  s.batch(label, () => {
    const run = pageRunOf(s);
    if (run === null) {
      const held = [...s.roots];
      createPageRun(s, next.pages, next.layout);
      placeOnPages(s, held, place);
      return;
    }
    const node = s.get(run)!;
    const keep = new Set(next.pages.map((p) => p.id));
    const dropped = pageIdsOf(s, run).filter((id) => !keep.has(pageOfNode(s, id)!));
    if (dropped.length > 0) s.removeMany(dropped);
    const info = runInfo(next.layout, node.pageRun!.pasteboard);
    if (!sameValue(node.pageRun, info)) s.setPageRun(run, info);
    const poses = pagePoses(next.pages, next.layout);
    for (const page of next.pages) {
      const id = pageNodeOf(s, page.id);
      if (id === null) addPageNode(s, run, page, poses.get(page.id)!);
      else writePage(s, id, page, poses.get(page.id)!);
    }
    orderPages(s, run, next.pages.map((p) => pageNodeOf(s, p.id)!));
    const pose = runPose(next.pages, next.layout);
    if (!sameValue(s.get(run)!.pose, pose)) s.setPose(run, pose);
  });
}

function edit<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  fallback: string,
  options: PageEditOptions,
  change: (pages: Page[]) => Page[],
): void {
  const doc = pagesOf(scene);
  const pages = change([...doc?.pages ?? []]);
  if (doc === null && pages.length === 0) return;
  setPages(scene, { ...doc, pages }, { ...options, label: options.label ?? fallback });
}

/** Insert `page` at `index`, by default after the last page. An index past either end is held to it, as {@link movePage}
 *  holds one. */
export function addPage<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  page: Page,
  options: PageEditOptions & { index?: number } = {},
): void {
  edit(scene, 'Add page', options, (pages) => {
    pages.splice(Math.max(0, Math.min(options.index ?? pages.length, pages.length)), 0, page);
    return pages;
  });
}

/** Delete page `id`, what is on it, and every node that follows any of that, as one entry. */
export function removePage<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  id: string,
  options: PageEditOptions = {},
): void {
  edit(scene, 'Delete page', options, (pages) => pages.filter((p) => p.id !== id));
}

/** Move page `id` to `index` in the page order. */
export function movePage<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  id: string,
  index: number,
  options: PageEditOptions = {},
): void {
  edit(scene, 'Move page', options, (pages) => {
    const at = pages.findIndex((p) => p.id === id);
    if (at < 0) return pages;
    const [page] = pages.splice(at, 1);
    pages.splice(Math.max(0, Math.min(index, pages.length)), 0, page!);
    return pages;
  });
}

/** Give page `id` a new size. What is on it keeps its place on it; the pages after it shift. */
export function resizePage<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  id: string,
  size: { readonly width: number; readonly height: number },
  options: PageEditOptions = {},
): void {
  edit(scene, 'Resize page', options, (pages) =>
    pages.map((p) => (p.id === id ? { ...p, width: size.width, height: size.height } : p)));
}

/** Rename page `id`; an empty name removes it. */
export function renamePage<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  id: string,
  name: string,
  options: PageEditOptions = {},
): void {
  edit(scene, 'Rename page', options, (pages) => pages.map((p) => {
    if (p.id !== id) return p;
    const { name: _old, ...rest } = p;
    return name === '' ? rest : { ...rest, name };
  }));
}
