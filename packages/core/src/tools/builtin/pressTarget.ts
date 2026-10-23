/** The reads `pressTarget` makes: the tree, and each node's kind. */
export interface PressTargetTree {
  getParent(id: string): string | null;
  getNode(id: string): unknown;
}

/**
 * The node a press on `hitId` selects: the outermost group above it that is
 * below `entered`, or `hitId` itself when there is none. With nothing entered
 * the walk runs to the root, and it does too when `entered` is not an
 * ancestor of the hit; a press inside the entered group stops at it, so
 * its direct members are what gets selected.
 */
export function pressTarget(
  tree: PressTargetTree,
  hitId: string,
  entered: string | null,
): string {
  let target = hitId;
  let id: string | null = tree.getParent(hitId);
  let steps = 0;
  while (id !== null && id !== entered && steps++ < 10_000) {
    if ((tree.getNode(id) as { kind?: string } | undefined)?.kind === 'group') target = id;
    id = tree.getParent(id);
  }
  return target;
}
