import type { ContainerBounds, LayoutChild } from '@weasel-js/core';
import type { Rect } from '@weasel-js/geom';
import type { TileGridOverflow } from './tileGrid';

/** Where a drop target sits in a tile grid. */
export interface TileMeta {
  col: number;
  row: number;
  cellRect: Rect;
}

/** A tile grid's options, resolved once: how its cells are laid out and numbered. */
export interface TileShape<TPose> {
  cols: number;
  rows: number;
  gap: number;
  byColumn: boolean;
  overflow: TileGridOverflow;
  /** Cells per line in fill order. */
  perLine: number;
  /** The declared line count. */
  minLines: number;
  centerOf(pose: TPose): { x: number; y: number };
}

/** The cells of a tile grid laid over one container. */
export interface TileGrid<TPose> {
  rectAt(index: number): Rect;
  /** The cell index `pose` sits in, overflow cells past the container
   *  included, or `null` in a gap or off the grid. */
  indexOf(pose: TPose): number | null;
  /** The cells a drop may land in, or an arrival be placed in, with the grid's
   *  children in it: the declared grid when it refuses overflow, and otherwise
   *  every whole line the children reach. */
  cells: number;
  /** The container bounds that hold `lineCount` lines at this pitch. */
  boundsFor(lineCount: number): ContainerBounds;
}

/** How many lines `n` children fill, never fewer than declared. */
export function linesFor(shape: TileShape<unknown>, n: number): number {
  return Math.max(shape.minLines, Math.ceil(n / shape.perLine));
}

/** The grid over `bounds` while it holds `n` children: its cell pitch, and
 *  how many cells it offers before running past the container. A growing
 *  grid spreads its lines over the container, which it keeps sized to fit
 *  them; the others always lay the declared grid over it. */
export function tileGridOf<TPose>(shape: TileShape<TPose>, bounds: ContainerBounds, n: number): TileGrid<TPose> {
  const { cols, rows, gap, byColumn, overflow, perLine, minLines } = shape;
  const lines = overflow === 'grow' ? linesFor(shape, n) : minLines;
  const c = byColumn ? lines : cols;
  const r = byColumn ? rows : lines;
  const cw = (bounds.width - gap * (c - 1)) / c;
  const ch = (bounds.height - gap * (r - 1)) / r;

  return {
    rectAt(index) {
      const along = index % perLine;
      const line = Math.floor(index / perLine);
      const col = byColumn ? line : along;
      const row = byColumn ? along : line;
      return { x: bounds.x + col * (cw + gap), y: bounds.y + row * (ch + gap), width: cw, height: ch };
    },
    indexOf(pose) {
      const p = shape.centerOf(pose);
      const col = Math.floor((p.x - bounds.x) / (cw + gap));
      const row = Math.floor((p.y - bounds.y) / (ch + gap));
      if (col < 0 || row < 0) return null;
      if (p.x - bounds.x - col * (cw + gap) >= cw) return null;
      if (p.y - bounds.y - row * (ch + gap) >= ch) return null;
      if (byColumn ? row >= rows : col >= cols) return null;
      return byColumn ? col * rows + row : row * cols + col;
    },
    cells: overflow === 'reject' ? cols * rows : linesFor(shape, n) * perLine,
    boundsFor(lineCount) {
      return byColumn
        ? { ...bounds, width: lineCount * cw + gap * (lineCount - 1) }
        : { ...bounds, height: lineCount * ch + gap * (lineCount - 1) };
    },
  };
}

/** The drop-target meta of cell `index`. */
export function tileMetaOf(shape: TileShape<unknown>, index: number, cellRect: Rect): TileMeta {
  const along = index % shape.perLine;
  const line = Math.floor(index / shape.perLine);
  return shape.byColumn
    ? { col: line, row: along, cellRect }
    : { col: along, row: line, cellRect };
}

/** The cell index a drop target's meta names. */
export function tileIndexOf(shape: TileShape<unknown>, m: TileMeta): number {
  return shape.byColumn ? m.col * shape.rows + m.row : m.row * shape.cols + m.col;
}

/**
 * Every child a cell of `into`, in the order of the cells they sit in on
 * `from`, so a reflow compacts the survivors rather than re-sorting them —
 * an earlier swap among them has to outlive a sibling leaving the grid.
 * Children sitting in no cell (a gap, or off the grid) sort last; ties break
 * by id so an arrangement with no cells yet is still deterministic. Past
 * the declared grid they run on at the same pitch.
 */
export function packTiles<TPose>(
  from: TileGrid<TPose>,
  into: TileGrid<TPose>,
  children: ReadonlyArray<LayoutChild<TPose>>,
  cellToPose: (cell: Rect, dragged: TPose) => TPose,
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

/** The free cell among the first `slots` whose center is nearest `at`, or -1 when none is free. */
export function nearestFreeCell(
  grid: TileGrid<unknown>,
  slots: number,
  taken: ReadonlySet<number>,
  at: { x: number; y: number },
): number {
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
  return best;
}
