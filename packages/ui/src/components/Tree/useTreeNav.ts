import { useMemo } from 'react';
import type { EventModifiers } from '@weasel-js/gestures';
import { useRowNavigation } from '../../useRowNavigation';
import type { TreeNode, TreeProps } from './treeTypes';
import { textOf, type VisibleRow } from './treeUtils';
import type { useTreeSelection } from './useTreeSelection';

const NO_MODS: EventModifiers = { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };

/** What a tree's keyboard navigation reads: the rows shown and which are open, the selection, and what a row does. */
export interface TreeNavArgs extends Pick<TreeProps, 'selectionMode' | 'selectionFollowsFocus' | 'pressFolds' | 'onAction'> {
  visible: readonly VisibleRow[];
  /** The shown node with this id. */
  nodeAt(id: string): TreeNode | undefined;
  expanded: ReadonlySet<string>;
  selection: ReturnType<typeof useTreeSelection>;
  toggle(node: TreeNode): boolean;
  /** The whole tree is disabled. */
  held: boolean;
  /** The tree is a treegrid. */
  grid: boolean;
}

/**
 * A tree's roving focus and its keys, and what activating a row does. The arrows move and fold, typing finds a row,
 * and focus carries the selection with it under `selectionFollowsFocus`; under `selectionMode="multiple"`, Shift
 * extends and Cmd/Ctrl+A takes every row. Activating a row, by a press or by Enter or Space, folds it under
 * `pressFolds`, selects it, and calls `onAction`. `rowBox` is the element a row's focus sits on.
 */
export function useTreeNav({
  visible, nodeAt, expanded, selection, selectionMode, selectionFollowsFocus, toggle, pressFolds, onAction, held, grid,
}: TreeNavArgs) {
  const { selectable, selected, disabled, single } = selection;
  const select = (id: string, mods: EventModifiers) => selection.select(id, mods, nav.anchor);

  const activate = (node: TreeNode, mods: EventModifiers) => {
    if (node.disabled || held) return;
    if (pressFolds) toggle(node);
    if (selectable) select(node.id, mods);
    onAction?.(node.id, mods);
  };

  const nav = useRowNavigation<HTMLElement>({
    rows: useMemo(() => visible.map((v) => ({ id: v.node.id, parentId: v.parentId })), [visible]),
    isSelected: (id) => selectable && selected.has(id),
    // Selection with focus, and Shift's range, pass over disabled rows: focus alone moves there.
    onReach: (id) => {
      if (selectable && selectionFollowsFocus && !disabled(id)) select(id, NO_MODS);
    },
    ...(selectionMode === 'multiple' ? {
      onExtend: (id: string) => { if (!single(id)) select(id, { ...NO_MODS, shiftKey: true }); },
      onSelectAll: selection.selectAll,
    } : {}),
    onAction: (id, mods) => { const node = nodeAt(id); if (node) activate(node, mods); },
    tree: {
      isBranch: (id) => !!nodeAt(id)?.children,
      isOpen: (id) => !!nodeAt(id)?.children && expanded.has(id),
      toggle: (id) => { const node = nodeAt(id); return node ? toggle(node) : false; },
    },
    textOf: (id) => { const node = nodeAt(id); return node ? textOf(node) : ''; },
  });
  // A treegrid's focused element is the row box; a tree's is the `li` around it.
  const rowBox = (id: string) => (grid ? nav.els.current.get(id) : nav.els.current.get(id)?.firstElementChild) as HTMLElement | undefined;
  return { nav, activate, rowBox };
}
