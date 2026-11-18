import type { KeyboardEvent } from 'react';
import { controlCellKey, enterControls } from './treeGridKeys';
import { handleMoveKey, type MoveKeyCtx } from './treeKeyboardMove';
import type { TreeNode, TreeProps } from './treeTypes';

/** What a row's keys reach in the tree around it. */
export interface TreeRowKeysHost {
  /** The tree is a treegrid, whose rows hold controls. */
  grid: boolean;
  expanded: ReadonlySet<string>;
  onRowKeyDown: TreeProps['onRowKeyDown'];
  /** What an Alt+arrow move needs, where the tree moves its rows. */
  moves: MoveKeyCtx | undefined;
  /** Move focus `delta` rows from `id`, extending the selection when asked. */
  step(id: string, delta: -1 | 1, extend: boolean): void;
  /** The tree's own keys: arrows, Home and End, typing, activation. */
  navKey(id: string, e: KeyboardEvent<HTMLElement>): void;
}

/**
 * A key on `node`'s row, in the order each claims it: a key in the row's controls, the consumer's `onRowKeyDown`,
 * an Alt+arrow move, Right into the controls, and then the tree's own keys.
 */
export function rowKeyDown(node: TreeNode, e: KeyboardEvent<HTMLElement>, host: TreeRowKeysHost): void {
  if (host.grid && controlCellKey(e, (delta, extend) => host.step(node.id, delta, extend))) return;
  if (e.target !== e.currentTarget) return;
  host.onRowKeyDown?.(node.id, e);
  if (e.defaultPrevented) return;
  if (host.moves && handleMoveKey(e, node.id, host.moves)) return;
  if (host.grid && enterControls(e, !!node.children && !host.expanded.has(node.id))) return;
  host.navKey(node.id, e);
}
