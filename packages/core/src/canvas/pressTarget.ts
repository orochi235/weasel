import { isPageStructure } from 'core/scene/nodeGates';

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
 * its direct members are what gets selected. A page or the page run stops
 * the walk as the entered group does: what is on a page is pressed as if at
 * the root.
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
    const node = tree.getNode(id) as { kind?: string; page?: unknown; pageRun?: unknown } | undefined;
    if (isPageStructure(node)) break;
    if (node?.kind === 'group') target = id;
    id = tree.getParent(id);
  }
  return target;
}

/** Whether a press can select `id` itself with `entered` entered: it lies inside `entered`
 *  (anywhere, when nothing is) and no group between them takes the press instead. */
export function pressSelects(tree: PressTargetTree, id: string, entered: string | null): boolean {
  if (pressTarget(tree, id, entered) !== id) return false;
  if (entered === null) return true;
  let at = tree.getParent(id);
  for (let steps = 0; at !== null && steps < 10_000; steps++) {
    if (at === entered) return true;
    at = tree.getParent(at);
  }
  return false;
}
