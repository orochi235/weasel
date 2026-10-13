import type { Rect } from '@weasel-js/geom';
import type { ContainerBounds, LayoutChild, LayoutSnap, LayoutStrategy } from '@weasel-js/core';
import { nearest } from '../snaps';
import { sequenceLayout } from './sequence';


/**
 * What `pack` does when its shelves run past the container's height.
 *
 * - `'reject'` (default) — refuse the child that would not fit, by any route.
 * - `'grow'` — the container's height follows its content, never below
 *   `minHeight`.
 * - `'scroll'` — the container keeps its size and the shelves run on below
 *   it; `contentExtent` reports the region they cover.
 */
export type PackOverflow = 'reject' | 'grow' | 'scroll';

/** Options for `pack`. */
export interface PackOptions<TPose> {
  /** Space between neighbors on a shelf and between shelves, in world units. Default 0. */
  gap?: number;
  /** What happens past the container's height. Default `'reject'`. */
  overflow?: PackOverflow;
  /** The least height a `'grow'` container shrinks to. Default 0. */
  minHeight?: number;
  /** Which index a drag means. Default `nearest()`. */
  snap?: LayoutSnap<TPose>;
  /** A child's box. Default reads `x`, `y`, `width`, and `height` off the pose. */
  rectOf?(pose: TPose): Rect;
  /** `pose` with its box's top-left at `at`. Default writes `x` and `y`. */
  moveTo?(pose: TPose, at: { x: number; y: number }): TPose;
}

/**
 * Layout strategy that packs children of any size onto shelves: left to
 * right at their own sizes, wrapping at the container's width, each shelf as
 * tall as its tallest child. A child wider than the container is refused.
 *
 * The children's order is the order they read in — shelf by shelf, left to
 * right. A drop inserts at the index nearest the pointer and everything after
 * it reflows.
 */
export function pack<TPose>(opts: PackOptions<TPose> = {}): LayoutStrategy<TPose> {
  const gap = opts.gap ?? 0;
  const overflow = opts.overflow ?? 'reject';
  const minHeight = opts.minHeight ?? 0;
  const rectOf = opts.rectOf ?? ((pose: TPose) => pose as unknown as Rect);
  const moveTo = opts.moveTo ?? ((pose: TPose, at) => ({ ...(pose as object), ...at }) as TPose);

  // Ties break by id, so children nobody has arranged yet still have an order.
  const readingOrder = (children: ReadonlyArray<LayoutChild<TPose>>): LayoutChild<TPose>[] =>
    children
      .map((c) => ({ c, r: rectOf(c.pose) }))
      .sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x || (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0))
      .map((e) => e.c);

  /** Shelf every child of `sequence`, and the height the shelves reach. Null when one is too wide. */
  function shelve(
    bounds: ContainerBounds,
    sequence: ReadonlyArray<LayoutChild<TPose>>,
  ): { poses: Map<string, TPose>; height: number } | null {
    const poses = new Map<string, TPose>();
    let x = 0;
    let y = 0;
    let shelf = 0;
    for (const c of sequence) {
      const { width, height } = rectOf(c.pose);
      if (width > bounds.width) return null;
      if (x > 0 && x + width > bounds.width) {
        y += shelf + gap;
        x = 0;
        shelf = 0;
      }
      poses.set(c.id, moveTo(c.pose, { x: bounds.x + x, y: bounds.y + y }));
      x += width + gap;
      shelf = Math.max(shelf, height);
    }
    return { poses, height: y + shelf };
  }

  const layout = sequenceLayout<TPose>({
    snap: opts.snap ?? nearest<TPose>(),
    labels: { drop: 'Pack drop', shift: 'Pack shift' },
    centerOf(pose) {
      const r = rectOf(pose);
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    },

    order: (_container, children) => readingOrder(children),

    place(container, sequence) {
      const shelved = shelve(container.bounds, sequence);
      if (!shelved) return null;
      return overflow === 'reject' && shelved.height > container.bounds.height ? null : shelved.poses;
    },

    resize(container, sequence) {
      if (overflow !== 'grow') return undefined;
      const height = Math.max(minHeight, shelve(container.bounds, sequence)?.height ?? 0);
      return height === container.bounds.height ? undefined : { ...container.bounds, height };
    },
  });

  return {
    ...layout,
    contentExtent(container, children) {
      const reach = shelve(container.bounds, readingOrder(children))?.height ?? 0;
      return { ...container.bounds, height: Math.max(container.bounds.height, reach) };
    },
  };
}
