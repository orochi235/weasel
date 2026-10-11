import { useMemo } from 'react';
import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import { Icon } from '../../icons';
import { PrefKindBadge } from '../Prefs/PrefKindBadge';
import { filterTree, Tree, treeBranchIds, type TreeNode } from '../Tree';
import { GROUP_ICON, type PaletteDrag } from './Palette';
import { keyOf, type SchemaNode } from './schemaEdit';
import { unplacedAt } from './unplaced';
import s from './PrefSchemaEditor.module.css';

const SEP = '/';
/** What leads the id of a row the schema does not hold. No key holds a `/`, so no schema path starts with one. */
const NEW = SEP;

function toRows(group: PrefGroup, path: string): TreeNode[] {
  return Object.entries(group.children).map(([key, child]) => {
    const id = `${path}${path === NEW ? '' : SEP}${key}`;
    const label = <>{child.name || key} <span className={s.treeKey}>({key})</span></>;
    const row = { id, label, textValue: `${child.name} ${key}`, ...(child.description ? { tooltip: child.description } : {}) };
    return isPrefLeaf(child)
      ? { ...row, trailing: <PrefKindBadge kind={child.kind} /> }
      : { ...row, leading: <Icon size={16} name={GROUP_ICON[child.as ?? 'section']} />, children: toRows(child, id) };
  });
}

/**
 * Nodes waiting for a place in the schema, as a tree to drag them out of: what the schema holds on no page, then
 * what its host says it does not hold yet. Each is whole already, with its key, its name and its description, and
 * lands as it is wherever the structure tree or the live preview takes it. A group dragged brings what it holds.
 */
export function UnplacedTree({ loose, looseAt, waiting, sought, selected, onSelect, onDrag, onDrop }: {
  /** The rows of what the schema holds on no page, each by its tree path. */
  loose: readonly TreeNode[];
  /** The schema's node at a tree path. */
  looseAt(path: string): SchemaNode | undefined;
  /** What the schema does not hold yet; `null` when nothing is left. */
  waiting: PrefGroup | null;
  /** What the structure's filter holds, lowercased: only rows whose name or key has it are listed. Empty for all. */
  sought: string;
  /** The tree path selected in the editor, marked here when it is one of these rows. */
  selected: string | null;
  /** A row the schema holds was picked. */
  onSelect(path: string): void;
  /** The drag left this tree and moved, or came back or ended (`null`). */
  onDrag(drag: PaletteDrag | null): void;
  onDrop(drag: PaletteDrag): void;
}) {
  const all = useMemo(() => [...loose, ...(waiting ? toRows(waiting, NEW) : [])], [loose, waiting]);
  const rows = useMemo(
    () => (sought === '' ? all : filterTree(all, (n) => (n.textValue ?? '').toLowerCase().includes(sought))),
    [all, sought],
  );
  const open = useMemo(() => treeBranchIds(all), [all]);
  const dragOf = (id: string, point: { x: number; y: number }): PaletteDrag | null => {
    const held = !id.startsWith(NEW);
    const node = held ? looseAt(id) : waiting ? unplacedAt(waiting, id.slice(NEW.length).split(SEP)) : undefined;
    if (!node) return null;
    const key = held ? keyOf(id) : id.split(SEP).at(-1)!;
    return { item: { id, label: node.name, icon: 'formLabel', key, make: () => node }, node, ...(held ? { from: id } : {}), ...point };
  };
  return (
    <Tree
      aria-label="Unplaced"
      nodes={rows}
      empty={<p className={s.storedEmpty}>{all.length === 0 ? 'Nothing is waiting for a place.' : 'Nothing matches.'}</p>}
      foldBy="leading"
      defaultExpandedIds={open}
      selectionMode="single"
      selectedIds={selected === null ? [] : [selected]}
      // Only a row the schema holds has attributes to show.
      onSelectionChange={(ids) => {
        const id = [...ids][0];
        if (id !== undefined && !id.startsWith(NEW)) onSelect(id);
      }}
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
