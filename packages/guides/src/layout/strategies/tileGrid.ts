import {
  createTransformOp,
  type Op,
  type ContainerBounds,
  type DropTarget,
  type LayoutArrival,
  type LayoutChild,
  type LayoutContainer,
  type LayoutDragged,
  type LayoutSnap,
  type LayoutStrategy,
} from '@weasel-js/core';
import { cellAt } from '../snaps';

type Rect = { x: number; y: number; width: number; height: number };

interface TileMeta {
  col: number;
  row: number;
  cellRect: Rect;
}

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
   *  `RectPose`). Override for point-only poses or other shapes. The
   *  `dragged` argument is the pre-drop pose of the child being placed —
   *  use it to preserve fields the cell rect doesn't carry (e.g. rotation,
   *  domain metadata). */
  cellToPose?(cellRect: Rect, dragged: TPose): TPose;
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
  const gap = opts.gap ?? 0;
  const byColumn = opts.flow === 'column';
  const overflow = opts.overflow ?? 'reject';
  const snap = opts.snap ?? cellAt<TPose>();
  const capacity = cols * rows;
  /** Cells per line in fill order, and the declared line count. */
  const perLine = byColumn ? rows : cols;
  const minLines = byColumn ? cols : rows;
  const cellToPose: (cell: Rect, dragged: TPose) => TPose =
    opts.cellToPose ?? ((cell, dragged) => {
      // Default: spread the cell rect over the dragged pose. Preserves any
      // extra fields the dragged pose carries.
      return { ...(dragged as object), ...cell } as TPose;
    });
  const centerOf = opts.centerOf ?? defaultCenterOf;

  const linesFor = (n: number): number => Math.max(minLines, Math.ceil(n / perLine));

  /** The grid over `bounds` while it holds `n` children: its cell pitch, and
   *  how many cells it offers before running past the container. A growing
   *  grid spreads its lines over the container, which it keeps sized to fit
   *  them; the others always lay the declared grid over it. */
  function gridOf(bounds: ContainerBounds, n: number) {
    const lines = overflow === 'grow' ? linesFor(n) : minLines;
    const c = byColumn ? lines : cols;
    const r = byColumn ? rows : lines;
    const cw = (bounds.width - gap * (c - 1)) / c;
    const ch = (bounds.height - gap * (r - 1)) / r;

    function rectAt(index: number): Rect {
      const along = index % perLine;
      const line = Math.floor(index / perLine);
      const col = byColumn ? line : along;
      const row = byColumn ? along : line;
      return { x: bounds.x + col * (cw + gap), y: bounds.y + row * (ch + gap), width: cw, height: ch };
    }

    /** The cell index `pose` sits in, overflow cells past the container
     *  included, or `null` in a gap or off the grid. */
    function indexOf(pose: TPose): number | null {
      const p = centerOf(pose);
      const col = Math.floor((p.x - bounds.x) / (cw + gap));
      const row = Math.floor((p.y - bounds.y) / (ch + gap));
      if (col < 0 || row < 0) return null;
      if (p.x - bounds.x - col * (cw + gap) >= cw) return null;
      if (p.y - bounds.y - row * (ch + gap) >= ch) return null;
      if (byColumn ? row >= rows : col >= cols) return null;
      return byColumn ? col * rows + row : row * cols + col;
    }

    /** The cells a drop may land in, or an arrival be placed in, with `n`
     *  children in the grid: the declared grid when it refuses overflow, and
     *  otherwise every whole line the children reach. */
    const cells = overflow === 'reject' ? capacity : linesFor(n) * perLine;

    /** The container bounds that hold `lines` lines at this pitch. */
    function boundsFor(lineCount: number): ContainerBounds {
      return byColumn
        ? { ...bounds, width: lineCount * cw + gap * (lineCount - 1) }
        : { ...bounds, height: lineCount * ch + gap * (lineCount - 1) };
    }

    return { rectAt, indexOf, cells, boundsFor };
  }

  const metaOf = (index: number, cellRect: Rect): TileMeta => {
    const along = index % perLine;
    const line = Math.floor(index / perLine);
    return byColumn
      ? { col: line, row: along, cellRect }
      : { col: along, row: line, cellRect };
  };
  const indexOfMeta = (m: TileMeta): number => (byColumn ? m.col * rows + m.row : m.row * cols + m.col);

  /** How many children the grid holds, not counting a drag from outside it. */
  const heldBy = (container: LayoutContainer, children: ReadonlyArray<LayoutChild<TPose>>, dragged?: LayoutDragged<TPose>): number =>
    dragged && dragged.sourceContainerId !== container.id
      ? children.filter((c) => c.id !== dragged.id).length
      : children.length;

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
    const grid = gridOf(container.bounds, children.length);
    const idx = indexOfMeta(target.meta as TileMeta);
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

  /**
   * Every child a cell of `into`, in the order of the cells they sit in on
   * `from`, so a reflow compacts the survivors rather than re-sorting them —
   * an earlier swap among them has to outlive a sibling leaving the grid.
   * Children sitting in no cell (a gap, or off the grid) sort last; ties break
   * by id so an arrangement with no cells yet is still deterministic. Past
   * the declared grid they run on at the same pitch.
   */
  function pack(
    from: ReturnType<typeof gridOf>,
    into: ReturnType<typeof gridOf>,
    children: ReadonlyArray<LayoutChild<TPose>>,
  ): Map<string, TPose> {
    const ordered = children
      .map((c) => ({ c, cell: from.indexOf(c.pose) }))
      .sort((a, b) => {
        if (a.cell !== b.cell) {
          if (a.cell === null) return 1;
          if (b.cell === null) return -1;
          return a.cell - b.cell;
        }
        return a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0;
      });
    const out = new Map<string, TPose>();
    for (let i = 0; i < ordered.length; i++) {
      out.set(ordered[i].c.id, cellToPose(into.rectAt(i), ordered[i].c.pose));
    }
    return out;
  }

  return {
    snap,

    childPoses(container, children) {
      const grid = gridOf(container.bounds, children.length);
      return pack(grid, grid, children);
    },

    getDropTargets(container, children, dragged) {
      const grid = gridOf(container.bounds, heldBy(container, children, dragged));
      // A drag from inside may land on an occupied cell and swap; one from
      // outside has nobody to swap with, so occupied cells are not offered.
      const occupied = new Set<number>();
      const fromOutside = dragged.sourceContainerId !== container.id;
      if (fromOutside) {
        for (const c of children) {
          if (c.id === dragged.id) continue;
          const idx = grid.indexOf(c.pose);
          if (idx !== null) occupied.add(idx);
        }
      }
      const offered: number[] = [];
      for (let i = 0; i < grid.cells; i++) if (!occupied.has(i)) offered.push(i);
      // A grid that takes overflow always has room for one more.
      if (fromOutside && offered.length === 0 && overflow !== 'reject') offered.push(grid.cells);
      return offered.map((i) => {
        const cellRect = grid.rectAt(i);
        return {
          pose: cellToPose(cellRect, dragged.pose),
          origin: { x: cellRect.x + cellRect.width / 2, y: cellRect.y + cellRect.height / 2 },
          meta: metaOf(i, cellRect) satisfies TileMeta,
        };
      });
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

    arrive(container, children, arrivals): LayoutArrival<TPose> | null {
      const n = children.length;
      if (overflow === 'reject' && n > capacity) return null;
      // The grid as it stood before these joined: its pitch is the one the
      // arrivals are placed at, and a growing grid extends by it.
      const grid = gridOf(container.bounds, n - arrivals.size);
      const slots = overflow === 'reject' ? capacity : linesFor(n) * perLine;
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
          const at = centerOf(c.pose);
          let best = -1;
          let bestD = Infinity;
          for (let i = 0; i < slots; i++) {
            if (taken.has(i)) continue;
            const r = grid.rectAt(i);
            const dx = r.x + r.width / 2 - at.x;
            const dy = r.y + r.height / 2 - at.y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = i; }
          }
          if (best < 0) return null;
          idx = best;
        }
        taken.add(idx);
        poses.set(c.id, cellToPose(grid.rectAt(idx), c.pose));
      }
      if (overflow !== 'grow') return { poses };
      const lines = linesFor(n);
      if (lines === linesFor(n - arrivals.size)) return { poses };
      return { poses, bounds: grid.boundsFor(lines) };
    },

    depart(container, children, departed): LayoutArrival<TPose> {
      const n = children.length;
      // The grid as it stood with the departed still in it: a grown grid
      // gives back whole lines at that pitch, down to its declared count.
      const before = gridOf(container.bounds, n + departed.size);
      const lines = linesFor(n);
      if (overflow !== 'grow' || lines === linesFor(n + departed.size)) {
        return { poses: pack(before, before, children) };
      }
      const bounds = before.boundsFor(lines);
      return { poses: pack(before, gridOf(bounds, n), children), bounds };
    },

    contentExtent(container, children) {
      const grid = gridOf(container.bounds, children.length);
      const lines = Math.ceil(children.length / perLine);
      if (lines <= minLines) return container.bounds;
      const reach = grid.boundsFor(lines);
      return overflow === 'grow'
        ? container.bounds
        : { ...reach, width: Math.max(reach.width, container.bounds.width), height: Math.max(reach.height, container.bounds.height) };
    },
  };
}
