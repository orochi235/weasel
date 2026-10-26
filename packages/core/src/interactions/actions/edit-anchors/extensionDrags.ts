/**
 * The path-edit extensions' share of an anchor or handle drag: the anchors
 * that follow it, where a dragged handle goes, the wheel, and what they draw.
 */
import type { OngoingOverlay } from '@weasel-js/routing';
import { translateAnchorBy, type AnchorSet } from '@weasel-js/geom';
import type {
  PathEditDrag,
  PathEditDragStart,
  PathEditExtension,
  PathEditHandleMove,
} from 'domains/paths/pathEditExtension';

type Point = { x: number; y: number };
type Wheel = { deltaX: number; deltaY: number; deltaZ: number };

/** Each extension's share of the drag `start` describes, in extension order. */
export function startExtensionDrags(
  extensions: readonly PathEditExtension[] | undefined,
  start: PathEditDragStart,
): PathEditDrag[] {
  const out: PathEditDrag[] = [];
  for (const ext of extensions ?? []) {
    const drag = ext.drag?.(start);
    if (drag) out.push(drag);
  }
  return out;
}

/** The anchors an anchor drag of `dragging` moves and each one's share, the
 *  largest any extension gives; null when none gives weights. */
export function dragWeights(drags: readonly PathEditDrag[], dragging: readonly number[]): Map<number, number> | null {
  let out: Map<number, number> | null = null;
  for (const drag of drags) {
    const weights = drag.weights?.();
    if (!weights) continue;
    out ??= new Map(dragging.map((i) => [i, 1]));
    for (const [flat, w] of weights) if (w > (out.get(flat) ?? 0)) out.set(flat, w);
  }
  return out;
}

/** Move every anchor of `set` that `weights` names by its share of `(dx, dy)`. */
export function translateWeighted(set: AnchorSet, weights: ReadonlyMap<number, number>, dx: number, dy: number): void {
  for (const [flat, w] of weights) translateAnchorBy(set, flat, dx * w, dy * w);
}

/** Where a dragged handle goes once every extension has placed it in turn. */
export function placeHandle(drags: readonly PathEditDrag[], to: Point, move: PathEditHandleMove): Point {
  let at = to;
  for (const drag of drags) if (drag.handle) at = drag.handle(at, move);
  return at;
}

/** Offer `wheel` to each extension until one claims it. */
export function claimWheel(drags: readonly PathEditDrag[], wheel: Wheel): boolean {
  return drags.some((drag) => drag.wheel?.(wheel) === true);
}

/** Every extension's overlays for `current`. */
export function extensionOverlays(drags: readonly PathEditDrag[], current: AnchorSet): OngoingOverlay[] {
  return drags.flatMap((drag) => drag.overlays?.(current) ?? []);
}

/** Tell every extension the drag is over. */
export function endExtensionDrags(drags: readonly PathEditDrag[]): void {
  for (const drag of drags) drag.end?.();
}
