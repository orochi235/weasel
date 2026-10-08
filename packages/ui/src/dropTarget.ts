/** Where a drop lands: among `parentId`'s children (`null` is the top level), at `index` counted before the drag
 *  removes anything. */
export interface TreeDropTarget {
  parentId: string | null;
  index: number;
}

/** One visible row, in display order, as {@link resolveDrop} reads it. */
export interface DropRow {
  id: string;
  parentId: string | null;
  /** 1 at the top level. */
  level: number;
  /** Position among its parent's children. */
  index: number;
  /** Can hold children, so a drop into it is possible. */
  branch: boolean;
  /** Its children are the rows that follow it. */
  expanded: boolean;
  childCount: number;
  top: number;
  height: number;
}

/** Which row draws the drop indicator, and where on it. */
export interface DropMark {
  id: string;
  where: 'before' | 'after' | 'into';
}

export interface ResolvedDrop {
  target: TreeDropTarget;
  mark: DropMark | null;
}

/** Client x of level 1, and the width of one level, for reading depth off the pointer. */
export interface DropIndent {
  originX: number;
  indent: number;
}

/**
 * Where a pointer over `rows` would drop. A leaf splits at its midpoint; a branch keeps its middle half for a drop
 * into it. Below the last row of a subtree, `indent` lets the pointer's x choose how many levels to climb out;
 * without it the drop stays at the row's own level, which is all a flat list needs.
 */
export function resolveDrop(
  rows: readonly DropRow[],
  p: { x: number; y: number },
  indent?: DropIndent,
): ResolvedDrop {
  if (rows.length === 0) return { target: { parentId: null, index: 0 }, mark: null };
  const i = rows.findIndex((r) => p.y < r.top + r.height);
  if (i === -1) return gapAfter(rows, rows.length - 1, p.x, indent);
  const r = rows[i]!;
  if (p.y < r.top) return before(r);
  const frac = (p.y - r.top) / r.height;
  if (r.branch) {
    if (frac < 0.25) return before(r);
    if (frac >= 0.75) return gapAfter(rows, i, p.x, indent);
    return { target: { parentId: r.id, index: r.childCount }, mark: { id: r.id, where: 'into' } };
  }
  return frac < 0.5 ? before(r) : gapAfter(rows, i, p.x, indent);
}

function before(r: DropRow): ResolvedDrop {
  return { target: { parentId: r.parentId, index: r.index }, mark: { id: r.id, where: 'before' } };
}

function gapAfter(rows: readonly DropRow[], i: number, x: number, indent: DropIndent | undefined): ResolvedDrop {
  const r = rows[i]!;
  const next = rows[i + 1];
  if (r.expanded && r.childCount > 0 && next) return before(next);
  const floor = next ? next.level : 1;
  let level = r.level;
  if (indent && floor < r.level) {
    const want = Math.floor((x - indent.originX) / indent.indent) + 1;
    level = Math.max(floor, Math.min(r.level, want));
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  let at = r;
  while (at.level > level && at.parentId !== null) {
    const up = byId.get(at.parentId);
    if (!up) break;
    at = up;
  }
  return { target: { parentId: at.parentId, index: at.index + 1 }, mark: { id: at.id, where: 'after' } };
}
