import { useMemo, useState } from 'react';
import type { TreeNode } from './Tree';

export function textOf(node: TreeNode): string {
  return node.textValue ?? (typeof node.label === 'string' ? node.label : '');
}

/** Whether any node, shown or folded away, has controls. */
export function hasControls(nodes: readonly TreeNode[]): boolean {
  return nodes.some((n) => n.controls != null || (!!n.children && hasControls(n.children)));
}

/** The ids of every node, shown or folded away, that `test` holds for. */
export function idsWhere(nodes: readonly TreeNode[], test: (n: TreeNode) => boolean, into = new Set<string>()): Set<string> {
  for (const n of nodes) {
    if (test(n)) into.add(n.id);
    if (n.children) idsWhere(n.children, test, into);
  }
  return into;
}

export function useControlledSet(
  value: Iterable<string> | undefined,
  initial: Iterable<string> | undefined,
  onChange: ((ids: Set<string>) => void) | undefined,
): [ReadonlySet<string>, (next: Set<string>) => void] {
  const [own, setOwn] = useState<ReadonlySet<string>>(() => new Set(initial));
  const controlled = useMemo(() => (value === undefined ? undefined : new Set(value)), [value]);
  const set = (next: Set<string>) => {
    if (value === undefined) setOwn(next);
    onChange?.(next);
  };
  return [controlled ?? own, set];
}

/** Which branches are open, held unless `value` is, and the two ways a branch changes: folded either way, or opened. */
export function useTreeFold(
  value: Iterable<string> | undefined,
  initial: Iterable<string> | undefined,
  onChange: ((ids: Set<string>) => void) | undefined,
  held: boolean,
) {
  const [expanded, setExpanded] = useControlledSet(value, initial, onChange);
  /** Fold or unfold a branch; false where the node is a leaf, or it or the tree is disabled. */
  const toggle = (node: TreeNode): boolean => {
    if (!node.children || node.disabled || held) return false;
    const next = new Set(expanded);
    if (next.has(node.id)) next.delete(node.id);
    else next.add(node.id);
    setExpanded(next);
    return true;
  };
  const expand = (id: string): void => { if (!expanded.has(id)) setExpanded(new Set(expanded).add(id)); };
  return { expanded, setExpanded, toggle, expand };
}

/** A row the tree shows: a node whose every ancestor is open. */
export interface VisibleRow {
  node: TreeNode;
  parentId: string | null;
  level: number;
  index: number;
}

/** The rows `nodes` shows with `expanded` open, top to bottom. */
export function visibleRows(nodes: readonly TreeNode[], expanded: ReadonlySet<string>): VisibleRow[] {
  const out: VisibleRow[] = [];
  const walk = (list: readonly TreeNode[], parentId: string | null, level: number) => {
    list.forEach((node, index) => {
      out.push({ node, parentId, level, index });
      if (node.children && expanded.has(node.id)) walk(node.children, node.id, level + 1);
    });
  };
  walk(nodes, null, 1);
  return out;
}
