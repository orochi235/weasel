import {
  createSetPoseOp,
  type Op,
  type DropTarget,
  type LayoutArrival,
  type LayoutChild,
  type LayoutContainer,
  type LayoutDragged,
  type LayoutSnap,
  type LayoutStrategy,
} from '@weasel-js/core';
import type { Rect } from '@weasel-js/geom';
import { cellThenNearest } from '../snaps';
import { defaultCenterOf } from './sequence';
import {
  linesFor, nearestFreeCell, packTiles, tileGridOf, tileIndexOf, tileMetaOf,
  type TileGrid, type TileMeta, type TileShape,
} from './tileCells';

/**
 * What a `tileGrid` does with a child past its `cols × rows` cells.
 *
 * - `'reject'` (default) — the grid holds `cols × rows` and refuses more, by
 *   any route: a drop finds no free cell, and an insert or reparent that would
 *   overfill it is reverted whole.
 * - `'grow'` — the grid adds a line of cells whenever the last one fills
 *   (a row, or a column for `flow: 'column'`) and the container grows by its
 *   pitch to hold it, and gives the line back when children leave and it
 *   empties. `rows` (or `cols`) is the minimum.
 * - `'scroll'` — the container keeps its size, and the extra children take
 *   cells past its last visible line, at the same pitch. `contentExtent`
 *   reports the region they cover, for a host to scroll over.
 */
export type TileGridOverflow = 'reject' | 'grow' | 'scroll';

/** Options for `tileGrid`. */
export interface TileGridOptions<TPose> {
  cols: number;
  rows: number;
  /** Gap between cells, in world units. Default 0. */
  gap?: number;
  /** The order cells fill in: along each row (`'row'`, the default) or down
   *  each column (`'column'`). It is also the direction an overflowing grid
   *  runs on in. */
  flow?: 'row' | 'column';
  /** What happens past `cols × rows` children. Default `'reject'`. */
  overflow?: TileGridOverflow;
  snap?: LayoutSnap<TPose>;
  /** Optional: map a cell rect + the dragged pose to the new pose. Default
   *  writes `{ x, y, width, height }` into the dragged pose (assumes
   *  `RectPose`). `dragged` is the pre-drop pose of the child being placed —
   *  use it to preserve fields the cell rect doesn't carry (e.g. rotation). */
  cellToPose?(cellRect: Rect, dragged: TPose): TPose;
  /** Optional: the point that decides which cell a child occupies — a child
   *  occupies the cell containing it. Default reads `x`/`y` plus half of
   *  `width`/`height` when the pose has them, which is the center of a
   *  `RectPose` and the point itself for a point pose. */
  centerOf?(pose: TPose): { x: number; y: number };
}

type CellToPose<TPose> = (cell: Rect, dragged: TPose) => TPose;

/** How many children the grid holds, not counting a drag from outside it. */
function heldBy<TPose>(container: LayoutContainer, children: ReadonlyArray<LayoutChild<TPose>>, dragged?: LayoutDragged<TPose>): number {
  return dragged && dragged.sourceContainerId !== container.id
    ? children.filter((c) => c.id !== dragged.id).length
    : children.length;
}

/** The swap dragging `dragged` onto `target` causes, or `null`. Preview and
 *  commit both use it, so they cannot disagree. */
function computeSwap<TPose>(
  shape: TileShape<TPose>,
  cellToPose: CellToPose<TPose>,
  container: LayoutContainer,
  children: ReadonlyArray<LayoutChild<TPose>>,
  dragged: LayoutDragged<TPose>,
  target: DropTarget<TPose> | null,
): { occupant: string; from: TPose; newPose: TPose } | null {
  if (target === null) return null;
  if (dragged.sourceContainerId !== container.id) return null;
  const grid = tileGridOf(shape, container.bounds, children.length);
  const idx = tileIndexOf(shape, target.meta as TileMeta);
  const occupant = children.find((c) => c.id !== dragged.id && grid.indexOf(c.pose) === idx);
  if (occupant === undefined) return null;
  // The occupant takes the cell the dragged child is leaving — where the
  // container state says it is now, which an earlier placement of the same
  // drop may have moved it to.
  const self = children.find((c) => c.id === dragged.id);
  const fromIdx = grid.indexOf(self ? self.pose : dragged.originPose);
  if (fromIdx === null || fromIdx === idx) return null;
  return { occupant: occupant.id, from: occupant.pose, newPose: cellToPose(grid.rectAt(fromIdx), occupant.pose) };
}

/** The cells a drag may drop into: every one for a drag from inside, which swaps; only the free
 *  ones for a drag from outside, plus one past the end when an overflowing grid is full. */
function offeredCells<TPose>(
  shape: TileShape<TPose>,
  grid: TileGrid<TPose>,
  children: ReadonlyArray<LayoutChild<TPose>>,
  dragged: LayoutDragged<TPose>,
  fromOutside: boolean,
): number[] {
  const occupied = new Set<number>();
  if (fromOutside) {
    for (const c of children) {
      if (c.id === dragged.id) continue;
      const idx = grid.indexOf(c.pose);
      if (idx !== null) occupied.add(idx);
    }
  }
  const offered: number[] = [];
  for (let i = 0; i < grid.cells; i++) if (!occupied.has(i)) offered.push(i);
  if (fromOutside && offered.length === 0 && shape.overflow !== 'reject') offered.push(grid.cells);
  return offered;
}

/** Each arrival's pose: its own cell when that is free and in reach, else the nearest free one;
 *  `null` when one finds no free cell among the first `slots`. */
function placeArrivals<TPose>(
  shape: TileShape<TPose>,
  grid: TileGrid<TPose>,
  slots: number,
  children: ReadonlyArray<LayoutChild<TPose>>,
  arrivals: ReadonlySet<string>,
  cellToPose: CellToPose<TPose>,
): Map<string, TPose> | null {
  const taken = new Set<number>();
  for (const c of children) {
    if (arrivals.has(c.id)) continue;
    const idx = grid.indexOf(c.pose);
    if (idx !== null) taken.add(idx);
  }
  const poses = new Map<string, TPose>();
  for (const c of children) {
    if (!arrivals.has(c.id)) continue;
    const own = grid.indexOf(c.pose);
    let idx: number;
    if (own !== null && own < slots && !taken.has(own)) {
      idx = own;
    } else {
      idx = nearestFreeCell(grid, slots, taken, shape.centerOf(c.pose));
      if (idx < 0) return null;
    }
    taken.add(idx);
    poses.set(c.id, cellToPose(grid.rectAt(idx), c.pose));
  }
  return poses;
}

/** A commit's ops: the occupant's swap, if `swapFor` finds one, then the dragged child's move. */
function dropOps<TPose>(
  dragged: LayoutDragged<TPose>,
  target: DropTarget<TPose> | null,
  swapFor: () => { occupant: string; from: TPose; newPose: TPose } | null,
  cellToPose: CellToPose<TPose>,
): Op[] {
  const ops: Op[] = [];
  let droppedPose: TPose;
  if (target === null) {
    droppedPose = dragged.pose;
  } else {
    const meta = target.meta as TileMeta;
    droppedPose = cellToPose(meta.cellRect, dragged.pose);
    const swap = swapFor();
    if (swap !== null) {
      ops.push(
        createSetPoseOp<TPose>({
          id: swap.occupant,
          from: swap.from,
          to: swap.newPose,
          label: 'Tile swap',
        }),
      );
    }
  }
  ops.push(
    createSetPoseOp<TPose>({
      id: dragged.id,
      from: dragged.originPose,
      to: droppedPose,
      label: 'Tile drop',
    }),
  );
  return ops;
}

/**
 * Layout strategy that arranges children into a grid of cells, one child per
 * cell. What happens past `cols × rows` children is the `overflow` policy.
 *
 * A child occupies the cell its pose sits in (see `centerOf`). A drag from
 * inside the container swaps with the child in the cell it lands on; a drop
 * from outside is offered only the free cells, so it lands in the nearest
 * free one. A child that joins by an insert or a reparent is placed the same
 * way, in the free cell nearest to where it was put.
 */
export function tileGrid<TPose>(
  opts: TileGridOptions<TPose>,
): LayoutStrategy<TPose> {
  const { cols, rows } = opts;
  const byColumn = opts.flow === 'column';
  const overflow = opts.overflow ?? 'reject';
  const snap = opts.snap ?? cellThenNearest<TPose>();
  const capacity = cols * rows;
  const shape: TileShape<TPose> = {
    cols,
    rows,
    gap: opts.gap ?? 0,
    byColumn,
    overflow,
    perLine: byColumn ? rows : cols,
    minLines: byColumn ? cols : rows,
    centerOf: opts.centerOf ?? defaultCenterOf,
  };
  const cellToPose: CellToPose<TPose> =
    opts.cellToPose ?? ((cell, dragged) => {
      // Default: spread the cell rect over the dragged pose. Preserves any
      // extra fields the dragged pose carries.
      return { ...(dragged as object), ...cell } as TPose;
    });
  const gridOf = (bounds: LayoutContainer['bounds'], n: number) => tileGridOf(shape, bounds, n);

  return {
    snap,

    childPoses(container, children) {
      const grid = gridOf(container.bounds, children.length);
      return packTiles(grid, grid, children, cellToPose);
    },

    getDropTargets(container, children, dragged) {
      const grid = gridOf(container.bounds, heldBy(container, children, dragged));
      // A drag from inside may land on an occupied cell and swap; one from
      // outside has nobody to swap with, so occupied cells are not offered.
      const fromOutside = dragged.sourceContainerId !== container.id;
      return offeredCells(shape, grid, children, dragged, fromOutside).map((i) => {
        const cellRect = grid.rectAt(i);
        return {
          pose: cellToPose(cellRect, dragged.pose),
          origin: { x: cellRect.x + cellRect.width / 2, y: cellRect.y + cellRect.height / 2 },
          meta: tileMetaOf(shape, i, cellRect) satisfies TileMeta,
        };
      });
    },

    reflowPoses(container, children, dragged, target) {
      const out = new Map<string, TPose>();
      const swap = computeSwap(shape, cellToPose, container, children, dragged, target);
      if (swap !== null) {
        out.set(swap.occupant, swap.newPose);
      }
      return out;
    },

    commitDrop(container, children, dragged, target) {
      return dropOps(dragged, target, () => computeSwap(shape, cellToPose, container, children, dragged, target), cellToPose);
    },

    arrive(container, children, arrivals): LayoutArrival<TPose> | null {
      const n = children.length;
      if (overflow === 'reject' && n > capacity) return null;
      // The grid as it stood before these joined: its pitch is the one the
      // arrivals are placed at, and a growing grid extends by it.
      const grid = gridOf(container.bounds, n - arrivals.size);
      const slots = overflow === 'reject' ? capacity : linesFor(shape, n) * shape.perLine;
      const poses = placeArrivals(shape, grid, slots, children, arrivals, cellToPose);
      if (poses === null) return null;
      if (overflow !== 'grow') return { poses };
      const lines = linesFor(shape, n);
      if (lines === linesFor(shape, n - arrivals.size)) return { poses };
      return { poses, bounds: grid.boundsFor(lines) };
    },

    depart(container, children, departed): LayoutArrival<TPose> {
      const n = children.length;
      // The grid as it stood with the departed still in it: a grown grid
      // gives back whole lines at that pitch, down to its declared count.
      const before = gridOf(container.bounds, n + departed.size);
      const lines = linesFor(shape, n);
      if (overflow !== 'grow' || lines === linesFor(shape, n + departed.size)) {
        return { poses: packTiles(before, before, children, cellToPose) };
      }
      const bounds = before.boundsFor(lines);
      return { poses: packTiles(before, gridOf(bounds, n), children, cellToPose), bounds };
    },

    contentExtent(container, children) {
      const grid = gridOf(container.bounds, children.length);
      const lines = Math.ceil(children.length / shape.perLine);
      if (lines <= shape.minLines) return container.bounds;
      const reach = grid.boundsFor(lines);
      return overflow === 'grow'
        ? container.bounds
        : { ...reach, width: Math.max(reach.width, container.bounds.width), height: Math.max(reach.height, container.bounds.height) };
    },
  };
}
