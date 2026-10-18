/** How {@link doubleClickTarget} reads the tree. */
export interface DoubleClickTree {
  parentOf: (id: string) => string | null;
  /** A node's routing kind; a node routed `'group'` is one a double-click can name. */
  kindOf: (id: string) => string | undefined;
  /** The group isolation is working inside, or null at the scene root. */
  scope: string | null;
}

/**
 * The node a double-click on `hitId` names: the outermost group on the way up from it, stopping
 * below `scope`, or `hitId` itself where no group stands between them. So a double-click on a
 * grouped member names the group, and each one inside an isolated group names the next group in.
 */
export function doubleClickTarget(hitId: string, tree: DoubleClickTree): string {
  const { parentOf, kindOf, scope } = tree;
  let named = hitId;
  let id: string | null = hitId;
  // Capped so a cyclic parent chain cannot hang the pick.
  for (let depth = 0; id !== null && id !== scope && depth < 10_000; depth++) {
    if (kindOf(id) === 'group') named = id;
    id = parentOf(id);
  }
  return named;
}
