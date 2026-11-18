import type { MouseEvent, PointerEvent } from 'react';
import type { EventModifiers } from '@weasel-js/gestures';
import { isInControlWithin } from '@weasel-js/gestures';
import { modsOf } from '../../useReorderDragList';
import type { TreeNode } from './treeTypes';
import type { TreeRowProps } from './TreeRow';
import type { useRowTip } from './useRowTip';

/** What a row's pointer and focus handlers reach in the tree around it. */
export interface TreeRowPointerHost {
  rowTip: ReturnType<typeof useRowTip>;
  /** The element a row's focus and tooltip sit on. */
  rowBox(id: string): HTMLElement | undefined;
  /** The roving focus took this row. */
  focused(id: string): void;
  activate(node: TreeNode, mods: EventModifiers): void;
  toggle(node: TreeNode): boolean;
  /** Starts a drag from a press on the row, when the tree drags its rows. */
  drag: ((id: string, e: PointerEvent<HTMLElement>) => void) | undefined;
  onRowContextMenu: ((id: string, e: MouseEvent<HTMLElement>) => void) | undefined;
}

/**
 * A row's handlers for the pointer and for focus: a press activates it unless it lands in its controls, a rest
 * opens its tooltip, and a press can start a drag.
 */
export function bindRowPointer(
  node: TreeNode,
  host: TreeRowPointerHost,
): Pick<TreeRowProps, 'onFocus' | 'onBlur' | 'onPress' | 'onToggle' | 'onPointerEnter' | 'onPointerLeave' | 'onPointerDown' | 'onContextMenu'> {
  const { rowTip, onRowContextMenu, drag } = host;
  const tipped = node.tooltip != null;
  return {
    onFocus: (e) => {
      if (e.target !== e.currentTarget) return;
      host.focused(node.id);
      // A press focuses the item too, and the pointer's own rest is what opens the tooltip then.
      if (tipped && e.currentTarget.matches(':focus-visible')) rowTip.rest(node.id, host.rowBox(node.id)!);
    },
    onBlur: (e) => { if (e.target === e.currentTarget) rowTip.clear(); },
    onPress: (e) => { if (!isInControlWithin(e.target, e.currentTarget)) host.activate(node, modsOf(e)); },
    onToggle: () => { host.toggle(node); },
    onPointerEnter: tipped ? (e) => rowTip.rest(node.id, e.currentTarget) : undefined,
    onPointerLeave: tipped ? rowTip.clear : undefined,
    onPointerDown: (e) => {
      rowTip.clear();
      drag?.(node.id, e);
    },
    onContextMenu: onRowContextMenu ? (e) => onRowContextMenu(node.id, e) : undefined,
  };
}
