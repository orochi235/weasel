import type { ResizeAnchor } from '@weasel-js/routing';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/**
 * A transform the selection underwent, kept relative so it can be applied to
 * whatever is selected next.
 *
 * - `translate`: a world offset.
 * - `rotate`: radians about the selection's center, or about each node's own
 *   center (`pivot: 'each'`).
 * - `scale`: the box the selection was resized to, in units of the box it
 *   started as (`{ x: 0, y: 0, width: 1, height: 1 }` is no change), and the
 *   anchor the resize held fixed.
 * - `duplicate`: copy the selection, offset by the world offset `(dx, dy)`, and
 *   select the copies.
 *
 * Offsets are world, so a repeat inside a turned group steps the way the drag
 * or nudge it repeats did on screen.
 */
export type RepeatableTransform =
  | { readonly kind: 'translate'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'rotate'; readonly angle: number; readonly pivot: 'union' | 'each' }
  | { readonly kind: 'scale'; readonly to: Bounds; readonly anchor: ResizeAnchor }
  | { readonly kind: 'duplicate'; readonly dx: number; readonly dy: number };

interface Entry {
  readonly transform: RepeatableTransform;
  /** The ids selected once it landed. */
  readonly subject: readonly string[];
}

const LAST = new WeakMap<object, Entry>();

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/**
 * The last transform recorded against `scene`, which `transformAgain` repeats.
 */
export function lastTransform(scene: object): RepeatableTransform | undefined {
  return LAST.get(scene)?.transform;
}

/**
 * Remember `transform` as the last one `scene` underwent, `subject` being the
 * ids selected once it landed. A translate of exactly the copies a
 * `duplicate` just made folds into it, so the copies' offset from their
 * sources is what repeats: duplicate, drag the copy, and each repeat steps
 * one more copy along.
 */
export function recordTransform(
  scene: object,
  transform: RepeatableTransform,
  subject: readonly string[],
): void {
  const prev = LAST.get(scene);
  if (
    transform.kind === 'translate'
    && prev?.transform.kind === 'duplicate'
    && sameIds(prev.subject, subject)
  ) {
    LAST.set(scene, {
      transform: { kind: 'duplicate', dx: prev.transform.dx + transform.dx, dy: prev.transform.dy + transform.dy },
      subject: [...subject],
    });
    return;
  }
  LAST.set(scene, { transform, subject: [...subject] });
}

/** Drop what `scene` remembers, so `transformAgain` has nothing to repeat. */
export function forgetTransform(scene: object): void {
  LAST.delete(scene);
}
