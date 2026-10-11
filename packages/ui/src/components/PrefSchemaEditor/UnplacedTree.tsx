import { useMemo } from 'react';
import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { Icon } from '../../icons';
import { PrefKindBadge } from '../Prefs/PrefKindBadge';
import { Tree, treeBranchIds, type TreeNode } from '../Tree';
import { GROUP_ICON, type PaletteDrag } from './Palette';
import { unplacedAt } from './unplaced';
import s from './PrefSchemaEditor.module.css';

const SEP = '/';

function toRows(group: PrefGroup, path: string | null): TreeNode[] {
  return Object.entries(group.children).map(([key, child]) => {
    const id = path === null ? key : `${path}${SEP}${key}`;
    const label = <span title={child.description || undefined}>{child.name || key} <span className={s.treeKey}>({key})</span></span>;
    return isPrefLeaf(child)
      ? { id, label, textValue: `${child.name} ${key}`, trailing: <PrefKindBadge kind={child.kind} /> }
      : { id, label, textValue: `${child.name} ${key}`, leading: <Icon size={16} name={GROUP_ICON[child.as ?? 'section']} />, children: toRows(child, id) };
  });
}

/**
 * Nodes waiting for a place in the schema, as a tree to drag them out of: each is whole already, with its key, its
 * name and its description, and lands as it is wherever the structure tree or the live preview takes it. A group
 * dragged brings what it holds.
 */
export function UnplacedTree({ unplaced, onDrag, onDrop }: {
  /** What is left to place; `null` when nothing is. */
  unplaced: PrefGroup | null;
  /** The drag left this tree and moved, or came back or ended (`null`). */
  onDrag(drag: PaletteDrag | null): void;
  onDrop(drag: PaletteDrag): void;
}) {
  const rows = useMemo(() => (unplaced ? toRows(unplaced, null) : []), [unplaced]);
  const open = useMemo(() => treeBranchIds(rows), [rows]);
  const dragOf = (id: string, point: { x: number; y: number }): PaletteDrag | null => {
    const keys = id.split(SEP);
    const node: PrefLeaf | PrefGroup | undefined = unplaced ? unplacedAt(unplaced, keys) : undefined;
    if (!node) return null;
    const key = keys.at(-1)!;
    return { item: { id, label: node.name, icon: 'formLabel', key, make: () => node }, node, ...point };
  };
  return (
    <Tree
      aria-label="Unplaced"
      nodes={rows}
      empty={<p className={s.storedEmpty}>Nothing is waiting for a place.</p>}
      foldBy="leading"
      defaultExpandedIds={open}
      // Rows leave this tree and never move within it.
      onMove={() => {}}
      canDrop={() => false}
      onDragOutside={(ids, point) => {
        const drag = point && ids[0] !== undefined ? dragOf(ids[0], point) : null;
        onDrag(drag);
        return drag !== null;
      }}
      onDropOutside={(ids, point) => {
        const drag = ids[0] !== undefined ? dragOf(ids[0], point) : null;
        if (drag) onDrop(drag);
        onDrag(null);
      }}
    />
  );
}
