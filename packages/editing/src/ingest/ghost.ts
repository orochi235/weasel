/**
 * What a drag still in flight would land as. A browser shows a hovering drag's
 * kinds and MIMEs and nothing else — no contents, no size — so the ghost is a
 * placeholder box per thing the drop would insert, where the handlers would put
 * it, at a size that reads the same at every zoom.
 */
import { rectPath, type Rect } from '@weasel-js/geom';
import { pendingKindOf, type ActionDeps, type IngestItem } from '@weasel-js/routing';
import { couldClaim, type ContentHandlerEntry, type IngestCtx } from '@weasel-js/core';
import { arrivalBounds } from '@weasel-js/core';
import type { IngestParams } from '@weasel-js/core';

/** A file's ghost is a square this fraction of the viewport's shorter side;
 *  a string's is twice as wide and a quarter as tall, the shape of a line. */
const GHOST_FRACTION = 1 / 6;

/**
 * The boxes a drop of `items` would fill: one per file some handler could
 * claim, or, when no file could be claimed, one for the strings, since a drag's
 * string flavors are several spellings of one thing. Cascaded and centered as
 * the kit's handlers place what they insert: a file by its place among every
 * file the drag carries.
 */
export function ghostBounds(
  items: readonly IngestItem[],
  at: Pick<IngestCtx, 'point' | 'viewportWorldRect' | 'worldPerPx'>,
  handlers?: readonly ContentHandlerEntry[],
): Rect[] {
  const claimable = items.filter((item) => couldClaim([item], handlers));
  const kindOf = (item: IngestItem) => pendingKindOf(item) ?? item.kind;
  const files = claimable.filter((item) => kindOf(item) === 'file');
  const hasString = claimable.some((item) => kindOf(item) === 'string');
  const view = at.viewportWorldRect();
  const side = Math.min(view.width, view.height) * GHOST_FRACTION;
  // A file keeps its place among every file carried, as the kit's handlers place it.
  const places = items.filter((item) => kindOf(item) === 'file');
  if (files.length > 0) return files.map((f) => arrivalBounds(at, { width: side, height: side }, places.indexOf(f)));
  return hasString ? [arrivalBounds(at, { width: side * 2, height: side / 4 }, 0)] : [];
}

/**
 * `Action.preview` for an action that ingests what a drop carries: draws
 * {@link ghostBounds} through the `previewPaths` dep. Reads `ingestion` and
 * `previewPaths`, which the action declares.
 */
export function previewIngest(
  deps: ActionDeps,
  params: Readonly<Partial<IngestParams>> | undefined,
  handlers?: readonly ContentHandlerEntry[],
): (() => void) | undefined {
  const items = params?.items;
  const { ingestion, previewPaths } = deps;
  if (!items || items.length === 0 || !ingestion || !previewPaths) return undefined;
  const point = params?.world ?? null;
  const at = {
    point,
    viewportWorldRect: () => ingestion.viewportWorldRect(),
    ...(ingestion.worldPerPx ? { worldPerPx: () => ingestion.worldPerPx!() } : {}),
  };
  const boxes = ghostBounds(items, at, handlers);
  if (boxes.length === 0) return undefined;
  return previewPaths.show(boxes.map((b) => ({ path: rectPath(b.x, b.y, b.width, b.height) })));
}
