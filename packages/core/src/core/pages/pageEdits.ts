/**
 * The edits that change a document's pages. A page is a node under the page
 * run, whose layout places it, so an edit writes the page nodes and the run
 * moves the pages; what is on a page is its children and goes with it,
 * stored poses untouched.
 */
import type { PoseDescriptor } from '../geometry/poseDescriptor';
import { sameValue } from '../scene/sameValue';
import type { NodeId, RectPose, Scene } from '../scene/types';
import type { Page, PlacedPage } from './pages';
import {
  addPageNode, createPageRun, pageIdsOf, pageInfo, pageRunOf, pagesOf, placedPagesOf, runInfo, runPose,
  type PagesDoc,
} from './pageNodes';

export { PAGES_DOC_KEY, pagesOf, placedPagesOf, type PagesDoc } from './pageNodes';

/** Options every page edit takes. */
export interface PageEditOptions {
  /** The undo entry's label. */
  label?: string;
  /** Accepted for compatibility and not read: membership is the tree, so nothing is measured. */
  descriptor?: PoseDescriptor<unknown>;
}

type AnyScene = Scene<unknown, string, unknown>;
const asAny = <TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>) =>
  scene as unknown as AnyScene;

/** An id none of `pages` has: `page-1`, `page-2`, and so on. */
export function nextPageId(pages: readonly Page[]): string {
  const taken = new Set(pages.map((p) => p.id));
  let n = 1;
  while (taken.has(`page-${n}`)) n++;
  return `page-${n}`;
}

/** The nodes on each placed page, by page id: the page's own children. `descriptor` is not read. */
export function pageMembers<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  placed: readonly PlacedPage[] = placedPagesOf(scene),
  _descriptor?: PoseDescriptor<unknown>,
): Map<string, NodeId[]> {
  return new Map(placed.map((p) => [p.id, scene.get(p.id as NodeId) ? [...scene.childrenOf(p.id as NodeId)] : []]));
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

/** Bring page node `id` to `page`'s size, name and meta. */
function writePage(scene: AnyScene, page: Page): void {
  const id = page.id as NodeId;
  const node = scene.get(id)!;
  const pose = node.pose as RectPose;
  if (pose.width !== page.width || pose.height !== page.height) {
    scene.setPose(id, { ...pose, width: page.width, height: page.height });
  }
  const info = pageInfo(page);
  if (!sameValue(node.page, info)) scene.setPage(id, info);
}

/**
 * Make the scene's pages `next`, as one undo entry labeled `label`: pages it
 * keeps are resized, renamed and reordered, new ones are added, and ones it
 * drops are deleted with everything on them and whatever follows that. A
 * scene with no page run gets one. Content keeps its place on its page.
 */
export function setPages<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  next: PagesDoc,
  label: string,
  _options: Pick<PageEditOptions, 'descriptor'> = {},
): void {
  const s = asAny(scene);
  s.batch(label, () => {
    const run = pageRunOf(s);
    if (run === null) {
      createPageRun(s, next.pages, next.layout);
      return;
    }
    const node = s.get(run)!;
    const keep = new Set(next.pages.map((p) => p.id));
    const dropped = pageIdsOf(s, run).filter((id) => !keep.has(id));
    if (dropped.length > 0) s.removeMany(dropped);
    const info = runInfo(next.layout, node.pageRun!.pasteboard);
    if (!sameValue(node.pageRun, info)) s.setPageRun(run, info);
    for (const page of next.pages) {
      if (s.get(page.id as NodeId) === undefined) addPageNode(s, run, page);
      else writePage(s, page);
    }
    orderPages(s, run, next.pages.map((p) => p.id as NodeId));
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
  const doc = pagesOf(scene) ?? { pages: [] };
  setPages(scene, { ...doc, pages: change([...doc.pages]) }, options.label ?? fallback);
}

/** Insert `page` at `index`, by default after the last page. */
export function addPage<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  page: Page,
  options: PageEditOptions & { index?: number } = {},
): void {
  edit(scene, 'Add page', options, (pages) => {
    pages.splice(options.index ?? pages.length, 0, page);
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
