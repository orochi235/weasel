import { createTransformOp } from '../../core/ops/transform';
import type {
  ContainerBounds,
  DropTarget,
  LayoutChild,
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

function findOccupantAt<TPose>(
  layoutPositions: Map<string, TPose>,
  cellRect: { x: number; y: number; width: number; height: number },
  excludeId: string,
): string | null {
  for (const [id, pose] of layoutPositions) {
    if (id === excludeId) continue;
    const p = pose as unknown as RectPose;
    if (
      p.x === cellRect.x &&
      p.y === cellRect.y &&
      p.width === cellRect.width &&
      p.height === cellRect.height
    ) {
      return id;
    }
  }
  return null;
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
      if (target === null) return out;
      const meta = target.meta as TileMeta;
      const sameContainer = dragged.sourceContainerId === container.id;
      // Use the current layout (all children including dragged) to find which
      // sibling currently occupies the picked cell.
      const layoutBefore = this.getChildPositions(container, children);
      const occupant = findOccupantAt(layoutBefore, meta.cellRect, dragged.id);
      if (occupant !== null && sameContainer) {
        // Swap: occupant moves to dragged's previous cell.
        const draggedOriginPose = dragged.originPose as unknown as RectPose;
        const occupantNewPose = {
          x: draggedOriginPose.x,
          y: draggedOriginPose.y,
          width: draggedOriginPose.width,
          height: draggedOriginPose.height,
        } as unknown as TPose;
        out.set(occupant, occupantNewPose);
      }
      // (Cross-container occupancy: spec leaves this as deferral —
      // for v1, dropping onto an occupied cell of a different container
      // displaces the occupant only when same-container. Cross-container
      // collisions fall back to free-space drop semantics from the gesture.)
      return out;
    },

    commitDrop(container, children, dragged, target) {
      const ops = [];
      const sameContainer = dragged.sourceContainerId === container.id;
      const layoutBefore = this.getChildPositions(container, children);

      let droppedPose: TPose;
      if (target === null) {
        droppedPose = dragged.pose;
      } else {
        const meta = target.meta as TileMeta;
        droppedPose = meta.cellRect as TPose;
        const occupant = findOccupantAt(layoutBefore, meta.cellRect, dragged.id);
        if (occupant !== null && sameContainer) {
          const dop = dragged.originPose as unknown as RectPose;
          const occupantNewPose = {
            x: dop.x,
            y: dop.y,
            width: dop.width,
            height: dop.height,
          } as unknown as TPose;
          ops.push(
            createTransformOp<TPose>({
              id: occupant,
              from: layoutBefore.get(occupant)!,
              to: occupantNewPose,
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
