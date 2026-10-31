/**
 * `grid` — nodes in rows of a fixed number of columns, read left to right and
 * top to bottom, as a block diagram stands them.
 *
 * Items go into cells in graph order: a node by its own place, a group by its
 * first member's, so a group stands where its first member would. An item
 * may span several columns and may leave empty cells before it. Every column
 * of one grid is as wide as its widest item needs, a spanning item sharing
 * its width out over its columns, and every row as tall as its tallest item;
 * an item is centered in its cells. A group is a grid of its own inside its
 * cells, with its own column count, and its box keeps its inset around that
 * grid. Columns sit `nodeGap` apart and rows `rankGap`, `nodeGap` when that is
 * unset. Edges and `direction` are ignored; pins and `tolerance` behave as in
 * every other layout.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { Graph, GraphGroup } from './graph';
import { DEFAULT_NODE_GAP, graphOrder, pinnedSet, translated, type LayoutFn } from './layout';

/** How `grid` fills its cells. Ids are node and group ids. */
export interface GridOptions {
  /** Columns at the top level. Unset, as many as it has items: one row. */
  columns?: number;
  /** Columns inside each group, by its id. Unset, as many as the group has items. */
  groupColumns?: Readonly<Record<string, number>>;
  /** How many columns an item spans. Default 1; at most its grid's columns. */
  spans?: Readonly<Record<string, number>>;
  /** How many cells are left empty before an item. Default 0. */
  skips?: Readonly<Record<string, number>>;
}

type Size = { width: number; height: number };

/** One grid's items, each with its size and the cell it starts in. */
interface Cells {
  items: { id: string; size: Size; row: number; col: number; span: number }[];
  columns: number;
}

/** The items at one level, in graph order: nodes directly there, and groups directly inside. */
function levels(graph: Graph): Map<string | null, string[]> {
  const order = graphOrder(graph);
  const groups = graph.groups ?? [];
  const first = new Map<string, number>(groups.map((g) => [g.id, Math.min(...g.members.map(order))]));
  const at = (id: string) => first.get(id) ?? order(id);
  const out = new Map<string | null, string[]>();
  const add = (level: string | null, id: string) => out.set(level, [...(out.get(level) ?? []), id]);
  for (const n of graph.nodes) add(n.group ?? null, n.id);
  for (const g of groups) add(g.parent ?? null, g.id);
  for (const ids of out.values()) ids.sort((a, b) => at(a) - at(b));
  return out;
}

/** Deals `ids` into cells, `columns` across. */
function deal(ids: readonly string[], sizeOf: (id: string) => Size, columns: number, grid: GridOptions): Cells {
  const items: Cells['items'] = [];
  let row = 0;
  let col = 0;
  for (const id of ids) {
    col += Math.max(0, Math.floor(grid.skips?.[id] ?? 0));
    row += Math.floor(col / columns);
    col %= columns;
    const span = Math.min(columns, Math.max(1, Math.floor(grid.spans?.[id] ?? 1)));
    if (col + span > columns) {
      row++;
      col = 0;
    }
    items.push({ id, size: sizeOf(id), row, col, span });
    col += span;
  }
  return { items, columns };
}

/** The grid's column width, each row's height, and where each item's top-left sits from the grid's corner. */
function place(cells: Cells, gap: number, rowGap: number): { at: Map<string, Vec2>; size: Size } {
  const width = Math.max(0, ...cells.items.map((i) => (i.size.width - (i.span - 1) * gap) / i.span));
  const rows: number[] = [];
  for (const i of cells.items) rows[i.row] = Math.max(rows[i.row] ?? 0, i.size.height);
  const tops: number[] = [];
  let y = 0;
  for (let r = 0; r < rows.length; r++) {
    tops[r] = y;
    y += (rows[r] ?? 0) + rowGap;
  }
  const at = new Map<string, Vec2>();
  for (const i of cells.items) {
    const across = i.span * width + (i.span - 1) * gap;
    at.set(i.id, { x: i.col * (width + gap) + (across - i.size.width) / 2, y: tops[i.row]! + ((rows[i.row] ?? 0) - i.size.height) / 2 });
  }
  const used = Math.max(0, ...cells.items.map((i) => i.col + i.span));
  return { at, size: { width: used === 0 ? 0 : used * width + (used - 1) * gap, height: rows.length === 0 ? 0 : y - rowGap } };
}

/** The grid layout: see the module comment. */
export const grid: LayoutFn = (graph, opts = {}) => {
  const gap = opts.nodeGap ?? DEFAULT_NODE_GAP;
  const rowGap = opts.rankGap ?? gap;
  const spec = opts.grid ?? {};
  const byLevel = levels(graph);
  const groups = new Map<string, GraphGroup>((graph.groups ?? []).map((g) => [g.id, g]));
  // Each group's inner grid, laid out innermost first, relative to its box's corner.
  const inner = new Map<string, { at: Map<string, Vec2>; size: Size }>();
  const sizeOf = (id: string): Size => {
    const g = groups.get(id);
    if (g === undefined) return graph.node(id)!.bounds;
    const laid = layOut(id);
    return {
      width: Math.max(g.minWidth ?? 0, laid.size.width + g.inset.left + g.inset.right),
      height: laid.size.height + g.inset.top + g.inset.bottom,
    };
  };
  const layOut = (level: string | null) => {
    const done = level === null ? undefined : inner.get(level);
    if (done !== undefined) return done;
    const ids = byLevel.get(level) ?? [];
    const columns = Math.max(1, Math.floor((level === null ? spec.columns : spec.groupColumns?.[level]) ?? ids.length));
    const laid = place(deal(ids, sizeOf, columns, spec), gap, rowGap);
    if (level !== null) inner.set(level, laid);
    return laid;
  };
  const placed = new Map<string, Vec2>();
  const put = (level: string | null, origin: Vec2) => {
    for (const [id, p] of layOut(level).at) {
      const corner = { x: origin.x + p.x, y: origin.y + p.y };
      const g = groups.get(id);
      if (g === undefined) {
        placed.set(id, corner);
        continue;
      }
      const slack = sizeOf(id).width - (inner.get(id)!.size.width + g.inset.left + g.inset.right);
      put(id, { x: corner.x + g.inset.left + slack / 2, y: corner.y + g.inset.top });
    }
  };
  put(null, { x: 0, y: 0 });
  return translated(graph, placed, pinnedSet(graph, opts), opts.tolerance);
};
