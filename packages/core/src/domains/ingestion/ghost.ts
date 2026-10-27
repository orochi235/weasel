/**
 * What a drag still in flight would land as. A browser shows a hovering drag's
 * kinds and MIMEs and nothing else — no contents, no size — so the ghost is a
 * placeholder box per thing the drop would insert, where the handlers would put
 * it, at a size that reads the same at every zoom.
 */
import { rectPath } from '@weasel-js/geom';
import { pendingKindOf, type ActionDeps, type IngestItem } from '@weasel-js/routing';
import { couldClaim, type ContentHandlerEntry, type IngestCtx } from './contentHandlers';
import { arrivalBounds } from './placement';
import type { ImmediateParams } from '@weasel-js/routing';

type Box = { x: number; y: number; width: number; height: number };

/** A file's ghost is a square this fraction of the viewport's shorter side;
 *  a string's is twice as wide and a quarter as tall, the shape of a line. */
const GHOST_FRACTION = 1 / 6;

/**
 * The boxes a drop of `items` would fill: one per file some handler could
 * claim, or, when no file could be claimed, one for the strings, since a drag's
 * string flavors are several spellings of one thing. Cascaded and centered as
 * the kit's handlers place what they insert.
 */
export function ghostBounds(
  items: readonly IngestItem[],
  at: Pick<IngestCtx, 'point' | 'viewportWorldRect'>,
  handlers?: readonly ContentHandlerEntry[],
): Box[] {
  const claimable = items.filter((item) => couldClaim([item], handlers));
  const kindOf = (item: IngestItem) => pendingKindOf(item) ?? item.kind;
  const files = claimable.filter((item) => kindOf(item) === 'file');
  const hasString = claimable.some((item) => kindOf(item) === 'string');
  const view = at.viewportWorldRect();
  const side = Math.min(view.width, view.height) * GHOST_FRACTION;
  const sizes = files.length > 0
    ? files.map(() => ({ width: side, height: side }))
    : hasString ? [{ width: side * 2, height: side / 4 }] : [];
  return sizes.map((size, i) => arrivalBounds(at, size, i));
}

/**
 * `Action.preview` for an action that ingests what a drop carries: draws
 * {@link ghostBounds} through the `previewPaths` dep. Reads `ingestion` and
 * `previewPaths`, which the action declares.
 */
export function previewIngest(
  deps: ActionDeps,
  params: Record<string, unknown> | undefined,
  handlers?: readonly ContentHandlerEntry[],
): (() => void) | undefined {
  const items = params?.items as IngestItem[] | undefined;
  const { ingestion, previewPaths } = deps;
  if (!items || items.length === 0 || !ingestion || !previewPaths) return undefined;
  const point = (params as ImmediateParams | undefined)?.world ?? null;
  const boxes = ghostBounds(items, { point, viewportWorldRect: () => ingestion.viewportWorldRect() }, handlers);
  if (boxes.length === 0) return undefined;
  return previewPaths.show(boxes.map((b) => ({ path: rectPath(b.x, b.y, b.width, b.height) })));
}
