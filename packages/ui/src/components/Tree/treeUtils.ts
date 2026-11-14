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
