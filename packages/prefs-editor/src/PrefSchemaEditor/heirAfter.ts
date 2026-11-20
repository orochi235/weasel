import { childrenOf, isUnder, joinPath, type SchemaNode, type SchemaRoot } from '@weasel-js/prefs/edit';
import { heirOf, type FocusRow } from '@weasel-js/ui';

/** The row that takes over once `paths` are removed, as the tree hands focus on ({@link heirOf}) over the rows drawn
 *  with `expanded` open, so the selection lands where focus does; removed rows a fold hides hand on to the row folding
 *  them. `null` when nothing is left. */
export function heirAfter(root: SchemaRoot, expanded: ReadonlySet<string>, paths: readonly string[]): string | null {
  const rows: FocusRow[] = [];
  const walk = (node: SchemaNode, parent: string | null): void => {
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
      const path = joinPath(parent, key);
      rows.push({ id: path, parentId: parent });
      if (expanded.has(path)) walk(child, path);
    }
  };
  walk(root, null);
  const gone = (id: string) => paths.some((p) => id === p || isUnder(id, p));
  const first = rows.find((r) => gone(r.id));
  if (first) return heirOf(rows, first.id, (id) => !gone(id));
  // Folded away, the removed rows hand on to the innermost drawn row that holds the first of them.
  let holder: string | null = null;
  for (const { id } of rows) {
    if (paths.some((p) => isUnder(p, id)) && (holder === null || isUnder(id, holder))) holder = id;
  }
  return holder;
}
