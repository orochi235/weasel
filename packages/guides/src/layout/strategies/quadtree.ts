import {
  createTransformOp,
  type ContainerBounds,
  type LayoutChild,
  type LayoutContainer,
  type LayoutSnap,
  type LayoutStrategy,
} from '@weasel-js/core';
import { containedThenNearest } from '../snaps';
import { defaultCenterOf } from './sequence';

type Rect = { x: number; y: number; width: number; height: number };

/** Options for `quadtree`. */
export interface QuadtreeOptions<TPose> {
  /** How many times the container may be quartered. Default 4, a 16 × 16 grid at its finest. */
  maxDepth?: number;
  /** Which free cell a drag means. Default `containedThenNearest()`. */
  snap?: LayoutSnap<TPose>;
  /** The length a cell's shorter side must reach to hold the child. Default
   *  is the larger of the pose's `width` and `height`. */
  sizeOf?(pose: TPose): number;
  /** The pose a child takes in a cell. Default centers the child's own size
   *  in the cell and keeps every other field. */
  cellToPose?(cell: Rect, pose: TPose): TPose;
  /** The point that decides which cell a child sits in. Default is the
   *  center of a `RectPose`, and the point itself for a point pose. */
  centerOf?(pose: TPose): { x: number; y: number };
}

/** One cell a child holds: {@link QuadtreeStrategy.cells}. */
export interface QuadtreeCell {
  id: string;
  /** How many times the container was quartered to reach the cell. */
  depth: number;
  rect: Rect;
}

/** A `quadtree` layout, which also reports the cells it has given out. */
export type QuadtreeStrategy<TPose> = LayoutStrategy<TPose> & {
  /** The cell each child holds, largest first: what a debug overlay draws. */
  cells(container: LayoutContainer, children: ReadonlyArray<LayoutChild<TPose>>): QuadtreeCell[];
};

interface Cell {
  depth: number;
  col: number;
  row: number;
}

/** Whether one cell is the other, or holds it. */
function overlaps(a: Cell, b: Cell): boolean {
  const [outer, inner] = a.depth <= b.depth ? [a, b] : [b, a];
  const shift = inner.depth - outer.depth;
  return inner.col >> shift === outer.col && inner.row >> shift === outer.row;
}

function rectOf(bounds: ContainerBounds, cell: Cell): Rect {
  const width = bounds.width / 2 ** cell.depth;
  const height = bounds.height / 2 ** cell.depth;
  return { x: bounds.x + cell.col * width, y: bounds.y + cell.row * height, width, height }
};

/** The free cell at `depth` nearest `at`: the one holding it, if that is free. */
function freeCell(bounds: ContainerBounds, taken: readonly Cell[], depth: number, at: { x: number; y: number }): Cell | null {
  let best: Cell | null = null;
  let bestD = Infinity;
  for (const cell of freeCells(taken, depth)) {
    const r = rectOf(bounds, cell);
    const d = (r.x + r.width / 2 - at.x) ** 2 + (r.y + r.height / 2 - at.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = cell;
    }
  }
  return best;
}

function freeCells(taken: readonly Cell[], depth: number): Cell[] {
  const out: Cell[] = [];
  const n = 2 ** depth;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const cell = { depth, col, row };
      if (!taken.some((t) => overlaps(t, cell))) out.push(cell);
    }
  }
  return out;
}

function defaultCellToPose<TPose>(cell: Rect, pose: TPose): TPose {
  const { width = 0, height = 0 } = pose as { width?: number; height?: number };
  return {
    ...(pose as object),
    x: cell.x + (cell.width - width) / 2,
    y: cell.y + (cell.height - height) / 2,
  } as TPose;
}

/**
 * Layout strategy that quarters its container as far as each child needs: a
 * child holds the smallest cell that fits it, so large and small children
 * share one container without a fixed grid. A cell is free while it, the
 * cells it sits inside, and the cells inside it hold nobody.
 *
 * A drag is offered the free cells of its own size. Children never move to
 * make room: a child that finds its cell covered goes to the nearest free
 * one, and an arrival with no free cell of its size is refused.
 */
export function quadtree<TPose>(opts: QuadtreeOptions<TPose> = {}): QuadtreeStrategy<TPose> {
  const maxDepth = opts.maxDepth ?? 4;
  const snap = opts.snap ?? containedThenNearest<TPose>();
  const cellToPose = opts.cellToPose ?? defaultCellToPose;
  const centerOf = opts.centerOf ?? defaultCenterOf;
  const sizeOf =
    opts.sizeOf ??
    ((pose: TPose) => {
      const { width = 0, height = 0 } = pose as { width?: number; height?: number };
      return Math.max(width, height);
    });

  /** The deepest level whose cells still hold a child of this pose. */
  function depthOf(bounds: ContainerBounds, pose: TPose): number {
    const size = sizeOf(pose);
    const side = Math.min(bounds.width, bounds.height);
    let depth = 0;
    while (depth < maxDepth && side / 2 ** (depth + 1) >= size) depth++;
    return depth;
  }

  /** A cell for every child that finds one, larger children first so a small
   *  one never takes the corner of a cell a large one needs whole. */
  function assign(bounds: ContainerBounds, children: ReadonlyArray<LayoutChild<TPose>>, held: readonly Cell[] = []) {
    const taken = [...held];
    const cells = new Map<string, Cell>();
    const bySize = children
      .map((c) => ({ c, depth: depthOf(bounds, c.pose) }))
      .sort((a, b) => a.depth - b.depth || (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0));
    for (const { c, depth } of bySize) {
      const cell = freeCell(bounds, taken, depth, centerOf(c.pose));
      if (!cell) continue;
      taken.push(cell);
      cells.set(c.id, cell);
    }
    return { cells, taken };
  }

  return {
    snap,

    childPoses(container, children) {
      const { cells } = assign(container.bounds, children);
      return new Map(
        children.map((c) => {
          const cell = cells.get(c.id);
          return [c.id, cell ? cellToPose(rectOf(container.bounds, cell), c.pose) : c.pose];
        }),
      );
    },

    getDropTargets(container, children, dragged) {
      const { taken } = assign(container.bounds, children.filter((c) => c.id !== dragged.id));
      return freeCells(taken, depthOf(container.bounds, dragged.pose)).map((cell) => {
        const hitBounds = rectOf(container.bounds, cell);
        return {
          pose: cellToPose(hitBounds, dragged.pose),
          origin: { x: hitBounds.x + hitBounds.width / 2, y: hitBounds.y + hitBounds.height / 2 },
          hitBounds,
        };
      });
    },

    reflowPoses: () => new Map(),

    commitDrop: (_container, _children, dragged, target) => [
      createTransformOp<TPose>({
        id: dragged.id,
        from: dragged.originPose,
        to: target?.pose ?? dragged.pose,
        label: 'Quadtree drop',
      }),
    ],

    arrive(container, children, arrivals) {
      const { taken } = assign(container.bounds, children.filter((c) => !arrivals.has(c.id)));
      const joining = children.filter((c) => arrivals.has(c.id));
      const { cells } = assign(container.bounds, joining, taken);
      if (cells.size < joining.length) return null;
      return {
        poses: new Map(joining.map((c) => [c.id, cellToPose(rectOf(container.bounds, cells.get(c.id)!), c.pose)])),
      };
    },

    cells(container, children) {
      const { cells } = assign(container.bounds, children);
      return [...cells]
        .map(([id, cell]) => ({ id, depth: cell.depth, rect: rectOf(container.bounds, cell) }))
        .sort((a, b) => a.depth - b.depth || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    },
  };
}
