import { pressTarget } from '../tools/builtin/pressTarget';

/** How {@link doubleClickTarget} reads the tree. */
export interface DoubleClickTree {
  parentOf: (id: string) => string | null;
  /** A node's routing kind; a node routed `'group'` is one a double-click can name. */
  kindOf: (id: string) => string | undefined;
  /** The group isolation or entry is working inside, or null at the scene root. */
  scope: string | null;
}

/**
 * The node a double-click on `hitId` names: what a press there would select, taken inside
 * `scope` (`pressTarget`). So a double-click on a grouped member names the outermost group
 * above it, and each one inside an isolated or entered group names the next group in.
 */
export function doubleClickTarget(hitId: string, tree: DoubleClickTree): string {
  return pressTarget(
    { getParent: tree.parentOf, getNode: (id) => ({ kind: tree.kindOf(id) }) },
    hitId,
    tree.scope,
  );
}
