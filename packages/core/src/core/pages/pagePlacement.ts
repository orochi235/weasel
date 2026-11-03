/**
 * Where content goes in a paged scene: the page under a point, and the shift
 * that keeps a box from leaving its page entirely.
 */
import type { Bounds } from '@weasel-js/routing';
import type { NodeId, Scene } from '../scene/types';
import { pageAt, pageHolding, type PlacedPage } from './pages';
import { pageRunOf, placedPagesOf } from './pageNodes';

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
