/**
 * Where content goes in a paged scene: the page under a point, and the shift
 * that keeps a box from leaving its page entirely.
 */
import type { Bounds } from '@weasel-js/routing';
import type { NodeId, Scene } from '../scene/types';
import { pageAt, pageHolding, pageOfBounds, type PlacedPage } from './pages';
import { pageOfNode, pageRunOf, placedPagesOf, type PageTreeReader } from './pageNodes';

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
  const run = pageRunOf(scene);
  const page = run === null ? undefined : followedPage(scene, node, pageOf);
  if (page === undefined) return null;
  return page === null ? run : page as NodeId;
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

/** Page `id` where it sits in world space, or `null` when `id` is not a page. */
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
