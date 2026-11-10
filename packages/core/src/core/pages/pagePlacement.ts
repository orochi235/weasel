/**
 * Where content goes in a paged scene: the page under a point, and the shift
 * that keeps a box from leaving its page entirely.
 */
import type { Bounds } from '@weasel-js/routing';
import type { NodeId, Scene } from '../scene/types';
import { pageAt, pageHolding, pageOfBounds, type PlacedPage } from './pages';
import { pageNodeOf, pageOfNode, pageRunOf, placedPagesOf, type PageTreeReader } from './pageNodes';

type AnyScene = Scene<unknown, string, unknown>;

/** Whether the scene's page run lets content sit outside every page. `false` in a scene without pages. */
export function pasteboardOn<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): boolean {
  const run = pageRunOf(scene);
  return run !== null && scene.get(run)!.pageRun!.pasteboard === true;
}

/** Whether `node` follows other nodes (`dependsOn` names some), and so belongs in the page run, not on a page. */
export function isFollower(node: { readonly dependsOn?: unknown } | undefined): boolean {
  const deps = node?.dependsOn;
  return Array.isArray(deps) && deps.length > 0;
}

/**
 * The page a node following others belongs on: the one every node it follows
 * is on, by `pageOf` (default where each is now). `null` when they span pages
 * or one is on none, and the node then belongs in the page run; `undefined`
 * for a node that follows none. The one rule for where a follower goes.
 */
export function followedPage(
  scene: PageTreeReader,
  node: { readonly dependsOn?: unknown } | undefined,
  pageOf: (id: NodeId) => string | null = (id) => pageOfNode(scene, id),
): string | null | undefined {
  if (!isFollower(node)) return undefined;
  const pages = new Set((node!.dependsOn as NodeId[]).map(pageOf));
  const [only] = pages;
  return pages.size === 1 && only != null ? only : null;
}

/** Where `node`, following others, belongs ({@link followedPage}): a page, or else the page run. `null` for
 *  a node that follows none, and in a scene without pages. */
export function followerHome<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  node: { readonly dependsOn?: unknown } | undefined,
  pageOf?: (id: NodeId) => string | null,
): NodeId | null {
  const page = pageRunOf(scene) === null ? undefined : followedPage(scene, node, pageOf);
  return page === undefined ? null : homeOfPage(scene, page);
}

/** The node a follower whose page is `page` is the child of: that page's node, or the page run for `null`.
 *  `null` in a scene without pages. */
export function homeOfPage<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  page: string | null,
): NodeId | null {
  const run = pageRunOf(scene);
  if (run === null) return null;
  return page === null ? run : pageNodeOf(scene, page) ?? run;
}

/** A node following others, as {@link followerLandings} reads it: one in the scene, or one about to be. */
export interface FollowerOf {
  readonly id: string;
  readonly dependsOn: readonly string[];
}

/**
 * The page each of `followers` belongs on by the follower rule
 * ({@link followedPage}) once the nodes in `landed` have landed, `null` for
 * the run. A node `landed` names, and anything under it, is on the page it
 * gives (`null`: on none); one of `followers` is on the page this finds for
 * it, so a follower of a follower comes out the same in any order; any other
 * node is on the page it is on now. A cycle of followers goes to the run.
 */
export function followerLandings(
  scene: PageTreeReader,
  landed: ReadonlyMap<string, string | null>,
  followers: readonly FollowerOf[],
): Map<string, string | null> {
  const byId = new Map(followers.map((f) => [f.id, f]));
  const out = new Map<string, string | null>();
  const visiting = new Set<string>();
  const pageOf = (dep: NodeId): string | null => {
    for (let at: NodeId | null | undefined = dep; at != null; at = scene.get(at)?.parent) {
      if (landed.has(at)) return landed.get(at)!;
      if (byId.has(at)) return resolve(byId.get(at)!);
    }
    return pageOfNode(scene, dep);
  };
  const resolve = (f: FollowerOf): string | null => {
    if (out.has(f.id)) return out.get(f.id)!;
    if (visiting.has(f.id)) return null;
    visiting.add(f.id);
    const page = followedPage(scene, f, pageOf) ?? null;
    visiting.delete(f.id);
    out.set(f.id, page);
    return page;
  };
  for (const f of followers) resolve(f);
  return out;
}

/**
 * The followers that move once each node `landed` names, with what is under
 * it, lands on the page it gives (`null`: on none), each with the node it
 * moves into (`homeOfPage`): any follower under the page run, outside what
 * lands, whose page by the follower rule (`followerLandings`) is not the page
 * it is on. Empty in a scene without pages. The one rule for every edit that
 * moves content between pages.
 */
export function rehomedFollowers<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  landed: ReadonlyMap<string, string | null>,
): Map<NodeId, NodeId> {
  const out = new Map<NodeId, NodeId>();
  const run = pageRunOf(scene);
  if (run === null || landed.size === 0) return out;
  const followers: FollowerOf[] = [];
  const visit = (id: NodeId) => {
    if (landed.has(id)) return;
    const follower = asFollower(id, scene.get(id));
    if (follower !== null) followers.push(follower);
    for (const child of scene.childrenOf(id)) visit(child);
  };
  visit(run);
  for (const [id, page] of followerLandings(scene, landed, followers)) {
    if (page === pageOfNode(scene, id as NodeId)) continue;
    const home = homeOfPage(scene, page);
    if (home !== null) out.set(id as NodeId, home);
  }
  return out;
}

/** Node `id`, holding `node`, as a {@link FollowerOf}, or `null` when it follows none. */
export function asFollower(id: string, node: { readonly dependsOn?: unknown } | undefined): FollowerOf | null {
  return isFollower(node) ? { id, dependsOn: node!.dependsOn as string[] } : null;
}

/**
 * The page under `world`. With no page there, `null` when the pasteboard is
 * on, else the page nearest the point (`pageHolding`). `null` in a scene
 * without pages.
 */
export function pageForPoint<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  world: { readonly x: number; readonly y: number },
): string | null {
  const placed = placedPagesOf(scene);
  const on = pageAt(placed, world);
  if (on !== null) return on.id;
  if (pasteboardOn(scene)) return null;
  return pageHolding(placed, { x: world.x, y: world.y, width: 0, height: 0 })?.id ?? null;
}

/**
 * The page a world box goes on: the one holding it (`pageHolding`), or with
 * the pasteboard on only one it overlaps (`pageOfBounds`). `null` off every
 * page with the pasteboard on, and in a scene without pages.
 */
export function pageForBounds<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  bounds: Bounds,
  placed: readonly PlacedPage[] = placedPagesOf(scene),
): PlacedPage | null {
  return pasteboardOn(scene) ? pageOfBounds(placed, bounds) : pageHolding(placed, bounds);
}

/** The page whose id (`Page.id`) is `id` where it sits in world space, or `null` when no page has it. */
export function placedPage<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  id: NodeId | string,
): PlacedPage | null {
  return placedPagesOf(scene as unknown as AnyScene).find((p) => p.id === id) ?? null;
}

/** The shift along one axis that leaves `need` of the span `[lo, lo + size)` inside `[min, max)`. */
function axisShift(min: number, max: number, lo: number, size: number): number {
  const need = Math.min(1, size, max - min);
  if (lo + size < min + need) return min + need - (lo + size);
  if (lo > max - need) return max - need - lo;
  return 0;
}

/** The smallest shift that leaves at least 1 world unit of `bounds` overlapping `pageRect` (all of it, when
 *  `bounds` is thinner than that). `{ dx: 0, dy: 0 }` for a box already on the page. */
export function keepOnPage(pageRect: Bounds, bounds: Bounds): { dx: number; dy: number } {
  return {
    dx: axisShift(pageRect.x, pageRect.x + pageRect.width, bounds.x, bounds.width),
    dy: axisShift(pageRect.y, pageRect.y + pageRect.height, bounds.y, bounds.height),
  };
}

/** Where a new group of some nodes goes, and how far its members move with it. */
export interface GroupingSite {
  readonly parent: NodeId | null;
  readonly shift: { readonly dx: number; readonly dy: number };
}

/**
 * The container for a new grouping of `ids`, whose members' union in the
 * world is `bounds`: their lowest common ancestor, unless it is the page run; else,
 * in a paged scene, the page that union overlaps most (`pageForBounds`), with
 * the pasteboard off moved so part of it is on that page (`keepOnPage`); else
 * the top of the tree, which is also where the union goes with the
 * pasteboard on and it off every page. The one rule for Group and for the
 * boolean group.
 */
export function groupingSite<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  ids: readonly NodeId[],
  bounds: Bounds | null,
): GroupingSite {
  const still = { dx: 0, dy: 0 };
  const run = pageRunOf(scene);
  const shared = commonAncestor(scene, ids);
  const allAtTop = ids.every((id) => (scene.get(id)?.parent ?? null) === null);
  if (shared !== run && (shared !== null || allAtTop)) return { parent: shared, shift: still };
  if (run === null || bounds === null) return { parent: null, shift: still };
  const page = pageForBounds(scene, bounds);
  if (page === null) return { parent: null, shift: still };
  return { parent: pageNodeOf(scene, page.id), shift: pasteboardOn(scene) ? still : keepOnPage(page, bounds) };
}

/** The deepest node every one of `ids` lies under, a member itself excluded; `null` for the top of
 *  the tree. */
export function commonAncestor(scene: PageTreeReader, ids: readonly NodeId[]): NodeId | null {
  const chainOf = (id: NodeId): NodeId[] => {
    const chain: NodeId[] = [];
    for (let at = scene.get(id)?.parent ?? null; at !== null; at = scene.get(at)?.parent ?? null) chain.push(at);
    return chain;
  };
  const [first, ...rest] = ids;
  if (first === undefined) return null;
  const others = rest.map((id) => new Set(chainOf(id)));
  return chainOf(first).find((at) => others.every((chain) => chain.has(at))) ?? null;
}
