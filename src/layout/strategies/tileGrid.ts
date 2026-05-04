import { createTransformOp } from '../../core/ops/transform';
import type { Op } from '../../core/ops/types';
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

export interface TileGridOptions<TPose> {
  cols: number;
  rows: number;
  /** Gap between cells, in world units. Default 0. */
  gap?: number;
  snap?: LayoutSnap<TPose>;
}

type RectPose = { x: number; y: number; width: number; height: number };

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

export function tileGrid<TPose extends RectPose>(
  opts: TileGridOptions<TPose>,
): LayoutStrategy<TPose> {
  const { cols, rows } = opts;
  const gap = opts.gap ?? 0;
  const snap = opts.snap ?? cellAt<TPose>();
  const capacity = cols * rows;

  function cellPose(bounds: ContainerBounds, col: number, row: number): TPose {
    return cellRectAt(bounds, cols, rows, gap, col, row) as TPose;
  }

  /**
   * Compute the swap induced by dragging `dragged` onto `target`, if any.
   * Returns `null` when there is no swap (cross-container drop, empty cell,
   * or null target). The same logic backs both `reflowFor` (preview) and
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
    const dop = dragged.originPose;
    const newPose: TPose = {
      x: dop.x,
      y: dop.y,
      width: dop.width,
      height: dop.height,
    } as TPose;
    return { occupant, newPose };
  }

  return {
    snap,

    getChildPositions(container, children) {
      const out = new Map<string, TPose>();
      const ids = sortedChildIds(children);
      for (let i = 0; i < ids.length && i < capacity; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        out.set(ids[i], cellPose(container.bounds, col, row));
      }
      return out;
    },

    getDropTargets(container, _children, _dragged) {
      const out: DropTarget<TPose>[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cellRect = cellRectAt(container.bounds, cols, rows, gap, col, row);
          out.push({
            pose: cellRect as TPose,
            origin: { x: cellRect.x + cellRect.width / 2, y: cellRect.y + cellRect.height / 2 },
            meta: { col, row, cellRect } satisfies TileMeta,
          });
        }
      }
      return out;
    },

    reflowFor(container, children, dragged, target) {
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
        droppedPose = meta.cellRect as TPose;
        const swap = computeSwap(container, children, dragged, target);
        if (swap !== null) {
          const layoutBefore = this.getChildPositions(container, children);
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
