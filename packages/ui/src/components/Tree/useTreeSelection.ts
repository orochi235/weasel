import { useMemo } from 'react';
import type { EventModifiers } from '@weasel-js/gestures';
import { intentOf, rangeOf, select as selectFrom, type SelectPolicy } from '@weasel-js/select';
import { listKeys, selectModifiers } from '../../useReorderDragList';
import type { TreeNode, TreeProps } from './treeTypes';
import { idsWhere, useControlledSet, type VisibleRow } from './treeUtils';

/** What a tree's selection reads: its props, the rows shown, and whether the tree is disabled. */
export interface TreeSelectionArgs extends Pick<TreeProps, 'selectionMode' | 'selectedIds' | 'defaultSelectedIds' | 'onSelectionChange'> {
  nodes: readonly TreeNode[];
  visible: readonly VisibleRow[];
  /** The shown node with this id. */
  nodeAt(id: string): TreeNode | undefined;
  /** The whole tree is disabled. */
  held: boolean;
}

/**
 * A tree's selection: held unless `selectedIds` is, and changed by a row's press or by keys. A range starts at
 * `anchor`, which the row navigation also moves, so each change is handed it.
 */
export function useTreeSelection({ nodes, visible, nodeAt, selectionMode = 'none', selectedIds, defaultSelectedIds, onSelectionChange, held }: TreeSelectionArgs) {
  const [selected, setSelected] = useControlledSet(selectedIds, defaultSelectedIds, onSelectionChange);
  const alone = useMemo(() => idsWhere(nodes, (n) => !!n.selectsAlone), [nodes]);

  const order = () => visible.map((v) => v.node.id);
  const disabled = (id: string) => held || !!nodeAt(id)?.disabled;
  // Neither joins a selection of more than one row.
  const single = (id: string) => disabled(id) || alone.has(id);
  const commit = (ids: readonly string[]) => {
    const next = new Set(ids);
    if (next.size !== selected.size || [...next].some((x) => !selected.has(x))) setSelected(next);
  };

  const select = (id: string, mods: EventModifiers, anchor: { current: string | null }) => {
    const policy: SelectPolicy = { mode: selectionMode === 'multiple' ? 'multiple' : 'single', ...listKeys() };
    const result = selectFrom({ ids: [...selected], anchor: anchor.current }, id, intentOf(selectModifiers(mods), policy), {
      order: order(), forceSingle: single,
    });
    anchor.current = result.anchor;
    commit(result.ids);
  };

  const selectAll = () => {
    if (held) return;
    const ids = order();
    commit(rangeOf(ids, ids[0]!, ids[ids.length - 1]!, single));
  };

  return { selected, selectable: selectionMode !== 'none', disabled, single, select, selectAll };
}
