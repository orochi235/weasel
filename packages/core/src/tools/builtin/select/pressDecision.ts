import { isEnvelope } from 'core/scene/effectivePose';
import { selectedAncestor } from '../../../interactions/actions/selectionSubtree';

/** The tree a press reads: who a node's parent is, and the node itself. */
export interface PressTree {
  getParent(id: string): string | null;
  getNode(id: string): unknown;
}

/** What a press on `top` does to the selection. */
export interface PressDecision {
  /** Apply the click to the selection on the press. */
  applyNow: boolean;
  /** The id the click is held back for until release, so the press can drag
   *  what is already selected instead; `null` when nothing is held back. */
  deferred: string | null;
}

/**
 * Decide a press with no extend modifier on `top`, and one with it.
 *
 * Pressing a member of a multi-selection, or a node inside a selected group,
 * leaves the selection alone: the press may be the start of a drag of the
 * set, or of the group. A group here is a container whose pose derives from
 * its children; one with its own pose is a place its members sit, and a press
 * picks the member out of it.
 */
export function pressDecision(
  top: string,
  sel: readonly string[],
  mods: { shift: boolean; meta: boolean },
  extendLocked: () => boolean,
  tree: PressTree,
): PressDecision {
  const isExtend = mods.shift || mods.meta;
  const inMultiSelection = sel.includes(top) && sel.length > 1;
  const defer = !isExtend && (inMultiSelection || insideSelectedGroup(top, sel, tree));
  return { applyNow: !defer && !(isExtend && extendLocked()), deferred: defer ? top : null };
}

function insideSelectedGroup(top: string, sel: readonly string[], tree: PressTree): boolean {
  if (sel.includes(top)) return false;
  const ancestor = selectedAncestor((id) => tree.getParent(id), top, new Set(sel));
  const node = ancestor === null ? undefined : tree.getNode(ancestor) as { dependsOn?: unknown; derivePose?: unknown } | undefined;
  return node !== undefined && isEnvelope(node);
}
