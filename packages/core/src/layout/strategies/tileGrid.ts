import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type {
  ContainerBounds,
  DropTarget,
  LayoutChild,
  LayoutContainer,
  LayoutDragged,
  LayoutSnap,
  LayoutStrategy,
} from '../types';
import { cellAt } from '../snaps';

interface TileMeta {
  col: number;
  row: number;
  cellRect: { x: number; y: number; width: number; height: number };
}

/** Options for `tileGrid`. */
export interface TileGridOptions<TPose> {
  cols: number;
  rows: number;
  /** Gap between cells, in world units. Default 0. */
  gap?: number;
  snap?: LayoutSnap<TPose>;
  /** Optional: map a cell rect + the dragged pose to the new pose. Default
   *  writes `{ x, y, width, height }` into the dragged pose (assumes
   *  `RectPose`). Override for point-only poses or other shapes. The
   *  `dragged` argument is the pre-drop pose of the child being placed —
   *  use it to preserve fields the cell rect doesn't carry (e.g. rotation,
   *  domain metadata). */
  cellToPose?(
    cellRect: { x: number; y: number; width: number; height: number },
    dragged: TPose,
  ): TPose;
  /** Optional: the point that decides which cell a child occupies — a child
   *  occupies the cell containing it. Default reads `x`/`y` plus half of
   *  `width`/`height` when the pose has them, which is the center of a
   *  `RectPose` and the point itself for a point pose. */
  centerOf?(pose: TPose): { x: number; y: number };
}

function defaultCenterOf(pose: unknown): { x: number; y: number } {
  const p = pose as { x?: number; y?: number; width?: number; height?: number };
  return { x: (p.x ?? 0) + (p.width ?? 0) / 2, y: (p.y ?? 0) + (p.height ?? 0) / 2 };
}

function cellRectAt(
  bounds: ContainerBounds,
  cols: number,
  rows: number,
  gap: number,
  col: number,
  row: number,
): { x: number; y: number; width: number; height: number } {
  const cw = (bounds.width - gap * (cols - 1)) / cols;
  const ch = (bounds.height - gap * (rows - 1)) / rows;
  return {
    x: bounds.x + col * (cw + gap),
    y: bounds.y + row * (ch + gap),
    width: cw,
    height: ch,
  };
}

function sortedChildIds<TPose>(children: ReadonlyArray<LayoutChild<TPose>>): string[] {
  return children.map((c) => c.id).sort();
}

/**
 * Layout strategy that arranges children into a fixed grid of cells, one
 * child per cell, and the container holds at most `cols × rows` children.
 *
 * A child occupies the cell its pose sits in (see `centerOf`). A drag from
 * inside the container swaps with the child in the cell it lands on; a drop
 * from outside is offered only the free cells, so it lands in the nearest
 * free one and a full grid rejects it.
 */
export function tileGrid<TPose>(
  opts: TileGridOptions<TPose>,
): LayoutStrategy<TPose> {
  const { cols, rows } = opts;
  const gap = opts.gap ?? 0;
  const snap = opts.snap ?? cellAt<TPose>();
  const capacity = cols * rows;
  const cellToPose: (cell: { x: number; y: number; width: number; height: number }, dragged: TPose) => TPose =
    opts.cellToPose ?? ((cell, dragged) => {
      // Default: spread the cell rect over the dragged pose. Preserves any
      // extra fields the dragged pose carries.
      return { ...(dragged as object), ...cell } as TPose;
    });

  const centerOf = opts.centerOf ?? defaultCenterOf;

  function cellPose(bounds: ContainerBounds, col: number, row: number, basis: TPose): TPose {
    return cellToPose(cellRectAt(bounds, cols, rows, gap, col, row), basis);
  }

  /** The cell index (`row * cols + col`) `pose` sits in, or `null` when it
   *  sits in a gap or outside the grid. */
  function cellIndexOf(bounds: ContainerBounds, pose: TPose): number | null {
    const p = centerOf(pose);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const r = cellRectAt(bounds, cols, rows, gap, col, row);
        if (p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height) {
          return row * cols + col;
        }
      }
    }
    return null;
  }

  /**
   * Compute the swap induced by dragging `dragged` onto `target`, if any.
   * Returns `null` when there is no swap (cross-container drop, empty cell,
   * or null target). The same logic backs both `reflowPoses` (preview) and
   * `commitDrop` (commit) so they cannot disagree.
   */
  function computeSwap(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: LayoutDragged<TPose>,
    target: DropTarget<TPose> | null,
  ): { occupant: string; from: TPose; newPose: TPose } | null {
    if (target === null) return null;
    if (dragged.sourceContainerId !== container.id) return null;
    const meta = target.meta as TileMeta;
    const idx = meta.row * cols + meta.col;
    const occupant = children.find(
      (c) => c.id !== dragged.id && cellIndexOf(container.bounds, c.pose) === idx,
    );
    if (occupant === undefined) return null;
    // The occupant takes the cell the dragged child is leaving — where the
    // container state says it is now, which an earlier placement of the same
    // drop may have moved it to.
    const self = children.find((c) => c.id === dragged.id);
    const fromIdx = cellIndexOf(container.bounds, self ? self.pose : dragged.originPose);
    if (fromIdx === null || fromIdx === idx) return null;
    const oldCellRect = cellRectAt(
      container.bounds, cols, rows, gap, fromIdx % cols, Math.floor(fromIdx / cols),
    );
    return { occupant: occupant.id, from: occupant.pose, newPose: cellToPose(oldCellRect, occupant.pose) };
  }

  return {
    snap,

    childPoses(container, children) {
      const out = new Map<string, TPose>();
      const ids = sortedChildIds(children);
      const byId = new Map(children.map((c) => [c.id, c.pose] as const));
      for (let i = 0; i < ids.length && i < capacity; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // Use each child's own pose as the basis so non-rect fields survive
        // the cellToPose mapping.
        out.set(ids[i], cellPose(container.bounds, col, row, byId.get(ids[i])!));
      }
      return out;
    },

    getDropTargets(container, children, dragged) {
      // A drag from inside may land on an occupied cell and swap; one from
      // outside has nobody to swap with, so occupied cells are not offered.
      const occupied = new Set<number>();
      if (dragged.sourceContainerId !== container.id) {
        for (const c of children) {
          if (c.id === dragged.id) continue;
          const idx = cellIndexOf(container.bounds, c.pose);
          if (idx !== null) occupied.add(idx);
        }
      }
      const out: DropTarget<TPose>[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (occupied.has(row * cols + col)) continue;
          const cellRect = cellRectAt(container.bounds, cols, rows, gap, col, row);
          out.push({
            pose: cellToPose(cellRect, dragged.pose),
            origin: { x: cellRect.x + cellRect.width / 2, y: cellRect.y + cellRect.height / 2 },
            meta: { col, row, cellRect } satisfies TileMeta,
          });
        }
      }
      return out;
    },

    reflowPoses(container, children, dragged, target) {
      const out = new Map<string, TPose>();
      const swap = computeSwap(container, children, dragged, target);
      if (swap !== null) {
        out.set(swap.occupant, swap.newPose);
      }
      return out;
    },

    commitDrop(container, children, dragged, target) {
      const ops: Op[] = [];

      let droppedPose: TPose;
      if (target === null) {
        droppedPose = dragged.pose;
      } else {
        const meta = target.meta as TileMeta;
        droppedPose = cellToPose(meta.cellRect, dragged.pose);
        const swap = computeSwap(container, children, dragged, target);
        if (swap !== null) {
          ops.push(
            createTransformOp<TPose>({
              id: swap.occupant,
              from: swap.from,
              to: swap.newPose,
              label: 'Tile swap',
            }),
          );
        }
      }
      ops.push(
        createTransformOp<TPose>({
          id: dragged.id,
          from: dragged.originPose,
          to: droppedPose,
          label: 'Tile drop',
        }),
      );
      return ops;
    },
  };
}
