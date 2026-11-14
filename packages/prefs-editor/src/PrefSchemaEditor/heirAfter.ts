import { childrenOf, isUnder, joinPath, type SchemaNode, type SchemaRoot } from '@weasel-js/prefs/edit';
import { heirOf, type FocusRow } from '@weasel-js/ui';

/** The row that takes over once `paths` are removed, as the tree hands focus on ({@link heirOf}) over the rows drawn
 *  with `expanded` open, so the selection lands where focus does. `null` when nothing is left. */
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
  return first ? heirOf(rows, first.id, (id) => !gone(id)) : null;
}
