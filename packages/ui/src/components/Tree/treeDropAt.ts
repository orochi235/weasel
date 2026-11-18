import { resolveDrop, type DropIndent, type DropRow, type ResolvedDrop } from '../../dropTarget';
import { inlineDirection } from '../../useRovingTabIndex';
import type { TreeNode } from './treeTypes';

/** A visible row as `Tree` walks it. */
export interface TreeDragRow {
  node: TreeNode;
  parentId: string | null;
  level: number;
  index: number;
}

/** The point and the level indent {@link resolveDrop} reads, measured along the inline direction: levels step in
 *  from the right in a right-to-left tree, so there both are read with x negated. */
function indentAt(
  visible: readonly TreeDragRow[], rowEl: (id: string) => HTMLElement | undefined, x: number, y: number,
): [{ x: number; y: number }, DropIndent | undefined] {
  const first = visible[0] && rowEl(visible[0].node.id);
  const deep = visible.find((v) => v.level > 1);
  const deepEl = deep && rowEl(deep.node.id);
  const parentEl = deep?.parentId != null ? rowEl(deep.parentId) : undefined;
  const flip = first && inlineDirection(first) === 'rtl' ? -1 : 1;
  const start = (el: HTMLElement): number => {
    const r = el.getBoundingClientRect();
    return flip < 0 ? -r.right : r.left;
  };
  const indent = first && deepEl && parentEl ? { originX: start(first), indent: start(deepEl) - start(parentEl) } : undefined;
  return [{ x: flip * x, y }, indent];
}

/** Where a drop at client `x`, `y` lands among the rows as they are drawn now, whether or not the tree would take it. */
export function dropAt(
  visible: readonly TreeDragRow[],
  rowEl: (id: string) => HTMLElement | undefined,
  expanded: ReadonlySet<string>,
  x: number,
  y: number,
): ResolvedDrop {
  const rows: DropRow[] = [];
  for (const v of visible) {
    const el = rowEl(v.node.id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    rows.push({
      id: v.node.id, parentId: v.parentId, level: v.level, index: v.index,
      branch: !!v.node.children, expanded: expanded.has(v.node.id),
      childCount: v.node.children?.length ?? 0, top: r.top, height: r.height,
    });
  }
  return resolveDrop(rows, ...indentAt(visible, rowEl, x, y));
}
