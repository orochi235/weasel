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

/** Layout strategy that arranges children into a fixed grid of cells, one
 *  child per cell. A drag reflows the others to make room, and the container
 *  holds at most `cols × rows` children. */
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

  function cellPose(bounds: ContainerBounds, col: number, row: number, basis: TPose): TPose {
    return cellToPose(cellRectAt(bounds, cols, rows, gap, col, row), basis);
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
  ): { occupant: string; newPose: TPose } | null {
    if (target === null) return null;
    if (dragged.sourceContainerId !== container.id) return null;
    const meta = target.meta as TileMeta;
    // Derive occupant by cell index from the current visual layout (sorted
    // ids include the dragged child, since the cell index corresponds to
    // pre-drop positions). If the cell currently holds the dragged itself,
    // no swap is needed.
    const ids = sortedChildIds(children);
    const idx = meta.row * cols + meta.col;
    const occupant = ids[idx] ?? null;
    if (occupant === null || occupant === dragged.id) return null;
    // The occupant takes the dragged child's old cell. Find that cell by
    // locating the dragged id in the same sorted-children index space.
    const draggedIdx = ids.indexOf(dragged.id);
    const draggedCol = draggedIdx % cols;
    const draggedRow = Math.floor(draggedIdx / cols);
    const oldCellRect = cellRectAt(container.bounds, cols, rows, gap, draggedCol, draggedRow);
    // Use the occupant's own pose as the basis so any non-rect fields
    // (rotation, domain metadata) are preserved.
    const occupantChild = children.find((c) => c.id === occupant);
    const basis = occupantChild ? occupantChild.pose : dragged.originPose;
    return { occupant, newPose: cellToPose(oldCellRect, basis) };
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

    getDropTargets(container, _children, dragged) {
      const out: DropTarget<TPose>[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
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
      // (Cross-container occupancy: spec leaves this as deferral —
      // for v1, dropping onto an occupied cell of a different container
      // displaces the occupant only when same-container. Cross-container
      // collisions fall back to free-space drop semantics from the gesture.)
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
          const layoutBefore = this.childPoses(container, children);
          ops.push(
            createTransformOp<TPose>({
              id: swap.occupant,
              from: layoutBefore.get(swap.occupant)!,
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
