import type { KeyboardEvent } from 'react';
import type { TreeDropTarget } from '../../dropTarget';
import type { TreeNode } from './Tree';
import { draggedIdsFor, isNoopMove, keyboardTarget, landsInside, parentsOf, type KeyboardMove } from './treeMoves';
import type { TreeDragHow } from './useTreeDrag';

const MOVE_KEYS: Record<string, KeyboardMove | undefined> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'out', ArrowRight: 'in',
};

interface MoveKeyCtx {
  nodes: readonly TreeNode[];
  selected: ReadonlySet<string>;
  expanded: ReadonlySet<string>;
  setExpanded(next: Set<string>): void;
  canDrop?(ids: readonly string[], target: TreeDropTarget, how: TreeDragHow): boolean;
  onMove(ids: string[], target: TreeDropTarget): void;
  /** Called with the moved node's id once a move is issued, so focus can follow it. */
  focusAfterMove(id: string): void;
}

/** Handle an Alt+arrow move on `nodeId`; returns true when the key was a move key (handled, default prevented). */
export function handleMoveKey(e: KeyboardEvent<HTMLElement>, nodeId: string, ctx: MoveKeyCtx): boolean {
  if (!e.altKey || e.metaKey || e.ctrlKey) return false;
  const dir = MOVE_KEYS[e.key];
  if (!dir) return false;
  e.preventDefault();
  const { nodes, canDrop } = ctx;
  const parents = parentsOf(nodes);
  const carried = draggedIdsFor(nodes, ctx.selected, nodeId);
  const ids = carried.every((x) => parents.get(x) === parents.get(nodeId)) ? carried : [nodeId];
  const target = keyboardTarget(nodes, ids, dir);
  if (!target || landsInside(nodes, ids, target) || isNoopMove(nodes, ids, target) || (canDrop && !canDrop(ids, target, { copy: false }))) {
    return true;
  }
  if (dir === 'in' && target.parentId !== null && !ctx.expanded.has(target.parentId)) {
    ctx.setExpanded(new Set(ctx.expanded).add(target.parentId));
  }
  ctx.focusAfterMove(nodeId);
  ctx.onMove(ids, target);
  return true;
}
