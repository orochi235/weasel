/**
 * Pages as scene nodes: a page run, the root that lays the document's pages
 * out, and one page node under it per page, framing what is on that page.
 */
import { maxOf } from '@weasel-js/geom';
import { composeWorldPose } from '../scene/composePose';
import { scenePoseAdapter } from '../scene/scenePoseAdapter';
import type { NodeId, RectPose, Scene } from '../scene/types';
import type { Page, PageLayoutOptions, PlacedPage } from './pages';
import { layoutPages } from './pages';
import { PAGE_RUN_LAYOUT } from './pageRunLayout';
import { pageClip } from './pageClip';

/** What makes a node a page (`SceneNode.page`): its name, and what other packages keep on it. */
export interface PageInfo {
  /** The page's id (`Page.id`), when its node's differs: a node already held that id when the page was made. */
  readonly id?: string;
  readonly name?: string;
  /** Each entry under its owner's key (`'diagram:graph'`); every page edit carries it. */
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** What makes a root the page run (`SceneNode.pageRun`): how it lays out its pages, and whether content may
 *  sit outside them. Its `origin` is not stored: the run's own pose is where the pages start. */
export interface PageRunInfo extends PageLayoutOptions {
  /** Content may sit outside every page, in world space. Default off. */
  readonly pasteboard?: boolean;
}

/** The document value a page list lived under before pages were nodes (`scene.doc`). Read only by
 *  `adoptLegacyPages`. */
export const PAGES_DOC_KEY = 'core:pages';

/** A document's pages in order and how they are laid out: what `pagesOf` reads off the nodes, and what
 *  `setPages` writes back. */
export interface PagesDoc {
  readonly pages: readonly Page[];
  readonly layout?: PageLayoutOptions;
}

type AnyScene = Scene<unknown, string, unknown>;

/** What finding a node's page reads of a scene. A `Scene` satisfies it. */
export interface PageTreeReader {
  get(id: NodeId): { readonly parent?: NodeId | null; readonly page?: unknown } | undefined;
}
const asAny = <TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>) =>
  scene as unknown as AnyScene;

/** The scene's page run: the root with a `pageRun` field, or `null` in a scene without pages. */
export function pageRunOf<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): NodeId | null {
  for (const id of scene.roots) if (scene.get(id)?.pageRun !== undefined) return id;
  return null;
}

/** Whether the scene is in Pages mode, which is whether it has a page run. */
export function isPaged<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): boolean {
  return pageRunOf(scene) !== null;
}

/** The page id (`Page.id`) of page node `node`, holding `info`: the node's own id unless the page's was taken. */
function pageIdOfNode(node: NodeId | string, info: unknown): string {
  return (info as PageInfo).id ?? node;
}

/** The page `id` is on, by its page id (`Page.id`): its nearest ancestor that is a page, or `id` itself when it
 *  is one. `null` off every page. */
export function pageOfNode(scene: PageTreeReader, id: NodeId): string | null {
  for (let at: NodeId | null | undefined = id; at != null; at = scene.get(at)?.parent) {
    const page = scene.get(at)?.page;
    if (page !== undefined) return pageIdOfNode(at, page);
  }
  return null;
}

/** The node of the page whose id (`Page.id`) is `pageId`, or `null` when no page has it. A page's node id is
 *  its page id unless another node held that id when the page was made. */
export function pageNodeOf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  pageId: string,
): NodeId | null {
  const own = scene.get(pageId as NodeId);
  if (own?.page !== undefined && pageIdOfNode(pageId, own.page) === pageId) return pageId as NodeId;
  const run = pageRunOf(scene);
  if (run === null) return null;
  return scene.childrenOf(run).find((id) => {
    const page = scene.get(id)?.page;
    return page !== undefined && pageIdOfNode(id, page) === pageId;
  }) ?? null;
}

/** The page nodes under `run`, in page order. */
export function pageIdsOf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  run: NodeId,
): NodeId[] {
  return scene.childrenOf(run).filter((id) => scene.get(id)?.page !== undefined);
}

/** Page node `id` as a {@link Page}: its page id, its info, and the size its pose gives it. */
function pageFromNode(scene: AnyScene, id: NodeId): Page {
  const node = scene.get(id)!;
  const { width, height } = node.pose as RectPose;
  const { id: _id, ...info } = node.page!;
  return { id: pageIdOfNode(id, node.page), width, height, ...info };
}

/** The scene's pages and their layout, read off the nodes, or `null` when it has no page run. */
export function pagesOf<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): PagesDoc | null {
  const s = asAny(scene);
  const run = pageRunOf(s);
  if (run === null) return null;
  const node = s.get(run)!;
  const { pasteboard: _pasteboard, ...layout } = node.pageRun!;
  const { x, y } = node.pose as RectPose;
  return {
    pages: pageIdsOf(s, run).map((id) => pageFromNode(s, id)),
    layout: x === 0 && y === 0 ? layout : { ...layout, origin: { x, y } },
  };
}

/** The scene's pages where they sit in world space; empty when it has no page run. */
export function placedPagesOf<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): PlacedPage[] {
  const s = asAny(scene);
  const run = pageRunOf(s);
  if (run === null) return [];
  const poses = scenePoseAdapter(s);
  return pageIdsOf(s, run).map((id, index) => {
    const { x, y } = composeWorldPose(poses, id, s.composition.compose) as RectPose;
    return { ...pageFromNode(s, id), x, y, index };
  });
}

/** The run's own pose: at `origin`, the size of the pages laid out from there. */
export function runPose(pages: readonly Page[], layout: PageLayoutOptions = {}): RectPose {
  const { x = 0, y = 0 } = layout.origin ?? {};
  const placed = layoutPages(pages, { ...layout, origin: { x, y } });
  const right = Math.max(x, maxOf(placed, (p) => p.x + p.width));
  const bottom = Math.max(y, maxOf(placed, (p) => p.y + p.height));
  return { x, y, width: right - x, height: bottom - y };
}

/** Each page's pose in the run's frame, by id: where `pageRunLayout` places it. An edit writes these itself, so
 *  the pages are in place while the edit is still open, before the run's layout pass has run. */
export function pagePoses(pages: readonly Page[], layout: PageLayoutOptions = {}): Map<string, RectPose> {
  return new Map(layoutPages(pages, { ...layout, origin: { x: 0, y: 0 } })
    .map((p) => [p.id, { x: p.x, y: p.y, width: p.width, height: p.height }]));
}

/** The `pageRun` field for `layout` and `pasteboard`: every stated setting but `origin`. */
export function runInfo(layout: PageLayoutOptions = {}, pasteboard?: boolean): PageRunInfo {
  const { origin: _origin, ...rest } = layout;
  return pasteboard === undefined ? rest : { ...rest, pasteboard };
}

/** The `page` field for `page` on node `node`: its id when the node's differs, and its name and meta, when it
 *  has them. */
export function pageInfo(page: Page, node: NodeId | string = page.id): PageInfo {
  return {
    ...(node !== page.id ? { id: page.id } : {}),
    ...(page.name !== undefined ? { name: page.name } : {}),
    ...(page.meta !== undefined ? { meta: page.meta } : {}),
  };
}

/** Options for {@link createPageRun}. */
export type CreatePageRunOptions<TLayer extends string> = PageLayoutOptions & {
  /** Content may sit outside every page. Default off. */
  pasteboard?: boolean;
  /** The layer the run and its pages go on. Default the scene's lowest, since nothing may sit below its parent. */
  layer?: TLayer;
};

/**
 * Make the scene paged: add the page run, a root group laid out by
 * `pageRunLayout`, and a group under it for each of `pages`, whose id is the
 * page's unless a node already holds it (`pageNodeOf`). One undo entry. Returns the run's id. The run and its pages hold
 * `data: undefined` whatever the scene's `TData`: a reader of every node's
 * `data` meets them too. Neither is pickable, and each page clips what is on
 * it to its rect (`pageClip`).
 */
export function createPageRun<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  pages: readonly Page[],
  options: CreatePageRunOptions<TLayer> = {},
): NodeId {
  const { pasteboard, layer = scene.layers[0]!.id, ...layout } = options;
  const s = asAny(scene);
  return s.batch('Add pages', () => {
    const run = s.add({
      kind: 'group', layer, pose: runPose(pages, layout), data: undefined, pickable: false,
      layout: PAGE_RUN_LAYOUT, pageRun: runInfo(layout, pasteboard),
    });
    const poses = pagePoses(pages, layout);
    for (const page of pages) addPageNode(s, run, page, poses.get(page.id)!);
    return run;
  });
}

/** Add `page` as a node at the end of `run`, at `pose` in the run's frame: under the page's id, or a fresh
 *  one when a node already holds it. */
export function addPageNode(scene: AnyScene, run: NodeId, page: Page, pose: RectPose): void {
  const id = scene.get(page.id as NodeId) === undefined ? page.id as NodeId : scene.mintId();
  scene.add({
    kind: 'group', layer: scene.get(run)!.layer, parent: run, id,
    pose, data: undefined, page: pageInfo(page, id), pickable: false, clipFromPose: pageClip,
  });
}
