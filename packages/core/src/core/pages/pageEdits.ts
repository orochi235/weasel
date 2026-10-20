/**
 * A document's pages as a scene document value, and the edits that change
 * them. Each edit moves the nodes on a page by however far the page itself
 * moved, so what is on a page stays where it is on that page.
 */
import {
  RECT_POSE_DESCRIPTOR, poseDescriptorForNode, translatePoseViaDescriptor, type PoseDescriptor,
} from '../geometry/poseDescriptor';
import { carriedDescendants, sceneCarrySource } from '../scene/carryDescendants';
import { effectivePose } from '../scene/effectivePose';
import type { NodeId, Scene } from '../scene/types';
import { layoutPages, pageOfBounds, type Page, type PageLayoutOptions, type PlacedPage } from './pages';

/** The document value under {@link PAGES_DOC_KEY}: the pages in order, and how they are laid out. */
export interface PagesDoc {
  readonly pages: readonly Page[];
  readonly layout?: PageLayoutOptions;
}

/** The scene document value key a page list lives under (`scene.doc`). */
export const PAGES_DOC_KEY = 'core:pages';

/** Options every page edit takes. */
export interface PageEditOptions {
  /** The undo entry's label. */
  label?: string;
  /** How node poses are measured and moved. Default: poses are rects. */
  descriptor?: PoseDescriptor<unknown>;
}

type AnyScene = Scene<unknown, string, unknown>;
const asAny = <TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>) =>
  scene as unknown as AnyScene;

/** The scene's pages doc, or `null` when it has none. */
export function pagesOf<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): PagesDoc | null {
  return scene.doc.get<PagesDoc>(PAGES_DOC_KEY) ?? null;
}

/** The scene's pages, placed in world space; empty when it has no pages doc. */
export function placedPagesOf<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): PlacedPage[] {
  const doc = pagesOf(scene);
  return doc ? layoutPages(doc.pages, doc.layout) : [];
}

/** An id none of `pages` has: `page-1`, `page-2`, and so on. */
export function nextPageId(pages: readonly Page[]): string {
  const taken = new Set(pages.map((p) => p.id));
  let n = 1;
  while (taken.has(`page-${n}`)) n++;
  return `page-${n}`;
}

/** Whether `id` draws from other nodes and goes wherever they go. */
function followsOthers(scene: AnyScene, id: NodeId): boolean {
  const deps = scene.get(id)?.dependsOn;
  return Array.isArray(deps) && deps.length > 0;
}

/**
 * The root nodes on each placed page, by page id: each root belongs to the
 * page its bounds overlap most (`pageOfBounds`). A root in the gaps belongs to
 * none, and one that derives from other nodes is left out, since it follows
 * them.
 */
export function pageMembers<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  placed: readonly PlacedPage[],
  descriptor: PoseDescriptor<unknown> = RECT_POSE_DESCRIPTOR as PoseDescriptor<unknown>,
): Map<string, NodeId[]> {
  const s = asAny(scene);
  const out = new Map<string, NodeId[]>(placed.map((p) => [p.id, []]));
  for (const id of s.roots) {
    const node = s.get(id);
    if (!node || followsOthers(s, id)) continue;
    const bounds = poseDescriptorForNode(descriptor, node).getBounds(effectivePose(s, node));
    const page = pageOfBounds(placed, bounds);
    if (page) out.get(page.id)!.push(id);
  }
  return out;
}

/** Whether a node's pose derives from its children, so moving them moves it. */
function derivesPose(scene: AnyScene, id: NodeId): boolean {
  const node = scene.get(id);
  return node?.dependsOn === 'children' && node.derivePose !== undefined;
}

/** The stored poses that move root `id` and what it carries by `dx`, `dy`: the
 *  root, unless its pose derives from its children (then each child moves in
 *  its place), and the descendants it carries, less whatever derives its pose. */
function pageMoveWrites(
  scene: AnyScene,
  id: NodeId,
  dx: number,
  dy: number,
  descriptor: PoseDescriptor<unknown>,
  out: { id: NodeId; pose: unknown }[],
): void {
  const node = scene.get(id);
  if (!node || followsOthers(scene, id)) return;
  if (derivesPose(scene, id)) {
    for (const child of scene.childrenOf(id)) pageMoveWrites(scene, child, dx, dy, descriptor, out);
    return;
  }
  const move = (pose: unknown, at: NodeId) => translatePoseViaDescriptor(pose, dx, dy, poseDescriptorForNode(descriptor, scene.get(at)!));
  out.push({ id, pose: move(node.pose, id) });
  const carried = carriedDescendants(sceneCarrySource(scene), id, (world, at) => (
    followsOthers(scene, at) || derivesPose(scene, at) ? null : move(world, at)
  ));
  for (const [at, pose] of carried) out.push({ id: at, pose });
}

/**
 * Replace the scene's pages doc with `next`, moving each page's members by
 * the change in their page's place, all as one undo entry labeled `label`.
 * Members of a page `next` drops are left where they are; `removePage` deletes
 * them first.
 */
export function setPages<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  next: PagesDoc,
  label: string,
  options: Pick<PageEditOptions, 'descriptor'> = {},
): void {
  const s = asAny(scene);
  const descriptor = options.descriptor ?? (RECT_POSE_DESCRIPTOR as PoseDescriptor<unknown>);
  const before = placedPagesOf(s);
  const after = new Map(layoutPages(next.pages, next.layout).map((p) => [p.id, p]));
  const members = pageMembers(s, before, descriptor);
  const writes: { id: NodeId; pose: unknown }[] = [];
  for (const page of before) {
    const to = after.get(page.id);
    if (!to) continue;
    const dx = to.x - page.x;
    const dy = to.y - page.y;
    if (dx === 0 && dy === 0) continue;
    for (const root of members.get(page.id) ?? []) pageMoveWrites(s, root, dx, dy, descriptor, writes);
  }
  s.batch(label, () => {
    for (const { id, pose } of writes) s.setPose(id, pose);
    s.doc.set(PAGES_DOC_KEY, next);
  });
}

function edit<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  fallback: string,
  options: PageEditOptions,
  change: (pages: Page[]) => Page[],
): void {
  const doc = pagesOf(scene) ?? { pages: [] };
  setPages(scene, { ...doc, pages: change([...doc.pages]) }, options.label ?? fallback, options);
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

/** Delete page `id`, what is on it, and every node that derives from that, as one entry. */
export function removePage<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  id: string,
  options: PageEditOptions = {},
): void {
  const label = options.label ?? 'Delete page';
  const members = pageMembers(scene, placedPagesOf(scene), options.descriptor).get(id) ?? [];
  scene.batch(label, () => {
    if (members.length > 0) scene.removeMany(members);
    edit(scene, label, { ...options, label }, (pages) => pages.filter((p) => p.id !== id));
  });
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

/** Give page `id` a new size. Its members keep their places on it; the pages after it shift. */
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
